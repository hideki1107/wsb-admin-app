"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  listExpenses,
  listProductsWithVariants,
  listSales,
} from "@/lib/repo";
import {
  SALES_CHANNELS,
  EXPENSE_CATEGORIES,
  type Expense,
  type ProductWithVariants,
  type Sale,
  type SalesChannel,
  type ExpenseCategory,
} from "@/lib/types";
import { CHANNEL_THEME, EXPENSE_THEME, getProductTheme } from "@/lib/theme";
import { yen } from "@/lib/format";

const LOW_STOCK_THRESHOLD = 5;

const ALL_YEARS = "all" as const;
const ALL_MONTHS = "all" as const;
type YearFilter = number | typeof ALL_YEARS;
type MonthFilter = number | typeof ALL_MONTHS;

export default function DashboardPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<ProductWithVariants[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<YearFilter>(ALL_YEARS);
  const [month, setMonth] = useState<MonthFilter>(ALL_MONTHS);
  const [loadAttempt, setLoadAttempt] = useState(0);

  function selectYear(next: YearFilter) {
    setYear(next);
    setMonth(ALL_MONTHS); // 年を変えたら月はリセット
  }

  useEffect(() => {
    let cancelled = false;

    // 25秒で諦めてエラー表示 (デフォだと無限に "読み込み中..." になる事象対策)
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError(
          "Firestore からの応答が25秒以内に返ってきませんでした。ネットワークやFirebase設定を確認してください。",
        );
        setLoading(false);
      }
    }, 25_000);

    (async () => {
      try {
        const [s, e, p] = await Promise.all([
          listSales(),
          listExpenses(),
          listProductsWithVariants(),
        ]);
        if (cancelled) return;
        setSales(s);
        setExpenses(e);
        setProducts(p);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        console.error("[dashboard load]", e);
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      } finally {
        clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [loadAttempt]);

  function retry() {
    setLoading(true);
    setError(null);
    setLoadAttempt((n) => n + 1);
  }

  // 全データに含まれる年の一覧 (新しい順)
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const s of sales) {
      const y = parseInt(s.occurredOn.slice(0, 4), 10);
      if (!Number.isNaN(y)) set.add(y);
    }
    for (const e of expenses) {
      const y = parseInt(e.occurredOn.slice(0, 4), 10);
      if (!Number.isNaN(y)) set.add(y);
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [sales, expenses]);

  // 選択中の年+月でフィルタしたデータ
  const filteredSales = useMemo(() => {
    let result = sales;
    if (year !== ALL_YEARS) {
      result = result.filter(
        (s) => parseInt(s.occurredOn.slice(0, 4), 10) === year,
      );
      if (month !== ALL_MONTHS) {
        result = result.filter(
          (s) => parseInt(s.occurredOn.slice(5, 7), 10) === month,
        );
      }
    }
    return result;
  }, [sales, year, month]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (year !== ALL_YEARS) {
      result = result.filter(
        (e) => parseInt(e.occurredOn.slice(0, 4), 10) === year,
      );
      if (month !== ALL_MONTHS) {
        result = result.filter(
          (e) => parseInt(e.occurredOn.slice(5, 7), 10) === month,
        );
      }
    }
    return result;
  }, [expenses, year, month]);

  // 選択中の年に含まれる月の一覧
  const availableMonths = useMemo(() => {
    if (year === ALL_YEARS) return [];
    const set = new Set<number>();
    for (const s of sales) {
      if (parseInt(s.occurredOn.slice(0, 4), 10) === year) {
        const m = parseInt(s.occurredOn.slice(5, 7), 10);
        if (!Number.isNaN(m)) set.add(m);
      }
    }
    for (const e of expenses) {
      if (parseInt(e.occurredOn.slice(0, 4), 10) === year) {
        const m = parseInt(e.occurredOn.slice(5, 7), 10);
        if (!Number.isNaN(m)) set.add(m);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [sales, expenses, year]);

  // 累計値 (フィルタ後)
  const revenue = useMemo(
    () => filteredSales.reduce((s, x) => s + x.amount, 0),
    [filteredSales],
  );
  const expenseTotal = useMemo(
    () => filteredExpenses.reduce((s, x) => s + x.amount, 0),
    [filteredExpenses],
  );

  // 注: バンド資金は **全期間** (フィルタ無し) の収支
  const balance = useMemo(
    () =>
      sales.reduce((s, x) => s + x.amount, 0) -
      expenses.reduce((s, x) => s + x.amount, 0),
    [sales, expenses],
  );

  // 収入カテゴリ別/支出カテゴリ別の集計 (フィルタ済)
  const channelTotals = useMemo(() => {
    const map = new Map<SalesChannel, { amount: number; count: number }>();
    for (const s of filteredSales) {
      const cur = map.get(s.channel) ?? { amount: 0, count: 0 };
      cur.amount += s.amount;
      cur.count += 1;
      map.set(s.channel, cur);
    }
    return map;
  }, [filteredSales]);

  const categoryTotals = useMemo(() => {
    const map = new Map<ExpenseCategory, { amount: number; count: number }>();
    for (const e of filteredExpenses) {
      const cur = map.get(e.category) ?? { amount: 0, count: 0 };
      cur.amount += e.amount;
      cur.count += 1;
      map.set(e.category, cur);
    }
    return map;
  }, [filteredExpenses]);

  // 月毎収支テーブル (フィルタ済データから生成)
  const monthlyRows = useMemo(
    () => buildMonthlyRows(filteredSales, filteredExpenses),
    [filteredSales, filteredExpenses],
  );

  // 在庫: 残1〜LOW_STOCK_THRESHOLD のみ (残0は非表示)
  const lowStock = useMemo(
    () =>
      products
        .flatMap((p) => p.variants.map((v) => ({ product: p, variant: v })))
        .filter(
          (x) =>
            x.variant.stock > 0 && x.variant.stock <= LOW_STOCK_THRESHOLD,
        )
        .sort((a, b) => a.variant.stock - b.variant.stock),
    [products],
  );

  if (loading)
    return (
      <p className="text-center text-base text-zinc-500 animate-pulse">
        読み込み中…
      </p>
    );
  if (error)
    return (
      <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-base text-rose-700">エラー: {error}</p>
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-rose-700"
        >
          再試行
        </button>
      </div>
    );

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ---- ヒーロー: バンド資金 ---- */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 p-6 text-white shadow-2xl shadow-fuchsia-200 sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -left-12 h-60 w-60 rounded-full bg-amber-300/40 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/85 sm:text-base">
            <span className="text-xl">💰</span>
            <span>現在のバンド資金</span>
            <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-normal">
              全期間
            </span>
          </div>
          <div className="mt-3 text-6xl font-extrabold tracking-tight sm:text-8xl">
            {yen(balance)}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 text-base sm:max-w-lg">
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
              <div className="text-sm text-white/75">
                累計収入 ({periodLabel(year, month)})
              </div>
              <div className="mt-1 text-xl font-bold sm:text-2xl">
                {yen(revenue)}
              </div>
            </div>
            <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
              <div className="text-sm text-white/75">
                累計支出 ({periodLabel(year, month)})
              </div>
              <div className="mt-1 text-xl font-bold sm:text-2xl">
                -{yen(expenseTotal)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- 年セレクタ ---- */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-zinc-600 sm:text-base">
            表示期間
          </span>
          <button
            onClick={() => selectYear(ALL_YEARS)}
            className={
              "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
              (year === ALL_YEARS
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300")
            }
          >
            全期間
          </button>
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => selectYear(y)}
              className={
                "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
                (year === y
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300")
              }
            >
              {y}年
            </button>
          ))}
        </div>

        {/* 月セレクタ (年を選んでいるときのみ) */}
        {year !== ALL_YEARS && availableMonths.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pl-4 sm:pl-0">
            <span className="text-xs font-bold text-zinc-500">月</span>
            <button
              onClick={() => setMonth(ALL_MONTHS)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition " +
                (month === ALL_MONTHS
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow"
                  : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300")
              }
            >
              全月
            </button>
            {availableMonths.map((m) => (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={
                  "rounded-full px-3 py-1 text-xs font-semibold transition " +
                  (month === m
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:ring-violet-300")
                }
              >
                {m}月
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ---- 月毎収支テーブル ---- */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-800 sm:text-2xl">
          <span>📅</span>月毎の収支
          <span className="text-sm font-normal text-zinc-500">
            ({periodLabel(year, month)})
          </span>
        </h2>
        {monthlyRows.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-base text-zinc-500 shadow-md">
            データなし
          </p>
        ) : (
          <>
            {/* ===== モバイル: カード形式 ===== */}
            <div className="space-y-3 lg:hidden">
              {monthlyRows.map((row) => {
                const net = row.incomeTotal - row.expenseTotal;
                return (
                  <div
                    key={row.ym}
                    className="overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-zinc-100"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-3">
                      <div className="text-base font-extrabold text-zinc-900">
                        {row.ym}
                      </div>
                      <div
                        className={
                          "text-xl font-extrabold tabular-nums " +
                          (net >= 0 ? "text-emerald-700" : "text-rose-700")
                        }
                      >
                        {net >= 0 ? "+" : ""}
                        {yen(net)}
                      </div>
                    </div>
                    <ul className="divide-y divide-zinc-100">
                      {SALES_CHANNELS.map((ch) => {
                        const v = row.byChannel[ch];
                        if (!v) return null;
                        const t = CHANNEL_THEME[ch];
                        return (
                          <li
                            key={ch}
                            className="flex items-center justify-between px-4 py-2"
                          >
                            <span
                              className={
                                "flex items-center gap-1.5 text-sm font-semibold " +
                                t.text
                              }
                            >
                              <span>{t.emoji}</span>
                              <span>{t.label}</span>
                            </span>
                            <span className="text-base font-bold tabular-nums text-zinc-900">
                              {yen(v)}
                            </span>
                          </li>
                        );
                      })}
                      {row.expenseTotal > 0 && (
                        <li className="flex items-center justify-between px-4 py-2">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                            <span>💸</span>
                            <span>支出計</span>
                          </span>
                          <span className="text-base font-bold tabular-nums text-rose-600">
                            -{yen(row.expenseTotal)}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* ===== デスクトップ: テーブル形式 ===== */}
            <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-lg ring-1 ring-zinc-100 lg:block">
              <table className="w-full text-sm sm:text-base">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
                    <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-3 font-semibold text-zinc-600 sm:px-4">
                      月
                    </th>
                    {SALES_CHANNELS.map((ch) => (
                      <th
                        key={ch}
                        className="px-3 py-3 text-right font-semibold sm:px-4"
                      >
                        <span className={CHANNEL_THEME[ch].text}>
                          {CHANNEL_THEME[ch].emoji} {CHANNEL_THEME[ch].label}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-semibold text-rose-600 sm:px-4">
                      💸 支出計
                    </th>
                    <th className="px-3 py-3 text-right font-semibold text-zinc-900 sm:px-4">
                      月次収支
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => {
                    const net = row.incomeTotal - row.expenseTotal;
                    return (
                      <tr
                        key={row.ym}
                        className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                      >
                        <td className="sticky left-0 z-10 bg-white px-3 py-3 font-bold text-zinc-700 sm:px-4">
                          {row.ym}
                        </td>
                        {SALES_CHANNELS.map((ch) => (
                          <td
                            key={ch}
                            className="px-3 py-3 text-right tabular-nums text-zinc-700 sm:px-4"
                          >
                            {row.byChannel[ch]
                              ? yen(row.byChannel[ch])
                              : <span className="text-zinc-300">-</span>}
                          </td>
                        ))}
                        <td className="px-3 py-3 text-right tabular-nums text-rose-600 sm:px-4">
                          {row.expenseTotal
                            ? `-${yen(row.expenseTotal)}`
                            : <span className="text-zinc-300">-</span>}
                        </td>
                        <td
                          className={
                            "px-3 py-3 text-right text-base font-bold tabular-nums sm:px-4 sm:text-lg " +
                            (net >= 0 ? "text-emerald-700" : "text-rose-700")
                          }
                        >
                          {net >= 0 ? "+" : ""}
                          {yen(net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ---- カテゴリ別収入 ---- */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-800 sm:text-2xl">
          <span>📊</span>カテゴリ別収入
          <span className="text-sm font-normal text-zinc-500">
            ({periodLabel(year, month)})
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {SALES_CHANNELS.map((ch) => {
            const t = CHANNEL_THEME[ch];
            const s = channelTotals.get(ch);
            return (
              <Link
                key={ch}
                href={buildListHref("/sales/list", ch, year, month)}
                className={
                  "block rounded-2xl bg-white p-4 shadow-lg ring-1 ring-inset transition hover:scale-105 hover:shadow-xl active:scale-95 sm:p-5 " +
                  t.ring
                }
              >
                <div
                  className={
                    "inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-md sm:h-12 sm:w-12 sm:text-2xl " +
                    t.gradient
                  }
                >
                  {t.emoji}
                </div>
                <div className="mt-3 text-sm font-medium text-zinc-500 sm:text-base">
                  {t.label}
                </div>
                <div className="mt-1 text-2xl font-extrabold text-zinc-900 sm:text-3xl">
                  {yen(s?.amount ?? 0)}
                </div>
                <div className={"mt-1 text-sm " + t.text}>
                  {s?.count ?? 0} 件
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- カテゴリ別支出 ---- */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-zinc-800 sm:text-2xl">
          <span>🧾</span>カテゴリ別支出
          <span className="text-sm font-normal text-zinc-500">
            ({periodLabel(year, month)})
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {EXPENSE_CATEGORIES.map((cat) => {
            const t = EXPENSE_THEME[cat];
            const s = categoryTotals.get(cat);
            return (
              <Link
                key={cat}
                href={buildListHref("/expenses/list", cat, year, month)}
                className={
                  "block rounded-2xl bg-white p-4 shadow-lg ring-1 ring-inset transition hover:scale-105 hover:shadow-xl active:scale-95 sm:p-5 " +
                  t.ring
                }
              >
                <div
                  className={
                    "inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow-md sm:h-12 sm:w-12 sm:text-2xl " +
                    t.gradient
                  }
                >
                  {t.emoji}
                </div>
                <div className="mt-3 text-sm font-medium text-zinc-500 sm:text-base">
                  {t.label}
                </div>
                <div className="mt-1 text-2xl font-extrabold text-zinc-900 sm:text-3xl">
                  {yen(s?.amount ?? 0)}
                </div>
                <div className={"mt-1 text-sm " + t.text}>
                  {s?.count ?? 0} 件
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ---- 在庫 ---- */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-bold text-zinc-800 sm:text-2xl">
            <span>📦</span>在庫
          </h2>
          <Link
            href="/inventory"
            className="text-sm font-semibold text-violet-600 hover:underline"
          >
            在庫一覧 →
          </Link>
        </div>
        {lowStock.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-base text-zinc-500 shadow-md">
            問題なし 👍
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lowStock.map(({ product, variant }) => {
              const t = getProductTheme(product);
              return (
                <li
                  key={variant.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-100 sm:p-5"
                >
                  <div
                    className={
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xl shadow " +
                      t.gradient
                    }
                  >
                    {t.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-semibold text-zinc-900 sm:text-lg">
                      {product.name}
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-500">
                      {[variant.color, variant.size]
                        .filter((x) => x && x !== "-")
                        .join(" / ") || "標準"}
                    </div>
                  </div>
                  <div className="ml-3 shrink-0 rounded-full bg-amber-100 px-3.5 py-1.5 text-sm font-bold text-amber-800">
                    残 {variant.stock}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// =========================================
// 月毎集計
// =========================================
interface MonthlyRow {
  ym: string;                                    // "2025-05" → "5月" 表示用
  byChannel: Partial<Record<SalesChannel, number>>;
  incomeTotal: number;
  expenseTotal: number;
}

function buildMonthlyRows(
  sales: Sale[],
  expenses: Expense[],
): MonthlyRow[] {
  const map = new Map<string, MonthlyRow>();

  const ensure = (key: string): MonthlyRow => {
    let row = map.get(key);
    if (!row) {
      row = {
        ym: formatYm(key),
        byChannel: {},
        incomeTotal: 0,
        expenseTotal: 0,
      };
      map.set(key, row);
    }
    return row;
  };

  for (const s of sales) {
    const key = s.occurredOn.slice(0, 7);  // YYYY-MM
    if (key.length !== 7) continue;
    const row = ensure(key);
    row.byChannel[s.channel] = (row.byChannel[s.channel] ?? 0) + s.amount;
    row.incomeTotal += s.amount;
  }
  for (const e of expenses) {
    const key = e.occurredOn.slice(0, 7);
    if (key.length !== 7) continue;
    const row = ensure(key);
    row.expenseTotal += e.amount;
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([, row]) => row);
}

function formatYm(key: string): string {
  // "2025-05" → "2025-05" but display as "5月" or "2025年5月" depending on space
  const m = parseInt(key.slice(5, 7), 10);
  const y = key.slice(0, 4);
  return `${y}年${m}月`;
}

function periodLabel(year: YearFilter, month: MonthFilter): string {
  if (year === ALL_YEARS) return "全期間";
  if (month === ALL_MONTHS) return `${year}年`;
  return `${year}年${month}月`;
}

function buildListHref(
  base: string,
  category: string,
  year: YearFilter,
  month: MonthFilter,
): string {
  const params = new URLSearchParams();
  params.set("category", category);
  if (year !== ALL_YEARS) params.set("year", String(year));
  if (year !== ALL_YEARS && month !== ALL_MONTHS)
    params.set("month", String(month));
  return `${base}?${params.toString()}`;
}
