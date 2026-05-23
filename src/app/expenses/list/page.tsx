"use client";

import { useState, useEffect, useMemo } from "react";
import {
  deleteExpense,
  listExpenses,
  updateExpense,
  type UpdateExpenseInput,
} from "@/lib/repo";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from "@/lib/types";
import { EXPENSE_THEME } from "@/lib/theme";
import { yen } from "@/lib/format";

type CategoryFilter = ExpenseCategory | "all";

export default function ExpensesListPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const filteredExpenses = useMemo(
    () =>
      filter === "all"
        ? expenses
        : expenses.filter((e) => e.category === filter),
    [expenses, filter],
  );

  async function refresh() {
    setExpenses(await listExpenses());
  }

  useEffect(() => {
    (async () => {
      try {
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading)
    return <p className="text-center text-base text-zinc-500">読み込み中…</p>;
  if (error)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base text-rose-700">
        {error}
      </div>
    );

  const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
          支出一覧
        </h1>
        <p className="mt-1 text-base text-zinc-500">
          {filteredExpenses.length}件 ・ 合計
          <span className="ml-1 font-bold text-rose-600">
            -{yen(total)}
          </span>
        </p>
      </div>

      <div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold uppercase tracking-wider text-zinc-500">
            カテゴリで絞り込み
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as CategoryFilter)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base font-semibold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 sm:w-72"
          >
            <option value="all">全カテゴリ</option>
            {EXPENSE_CATEGORIES.map((cat) => {
              const t = EXPENSE_THEME[cat];
              return (
                <option key={cat} value={cat}>
                  {t.emoji} {t.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-base text-zinc-500 shadow-md">
          {expenses.length === 0
            ? "まだ記録がありません"
            : "該当する記録がありません"}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filteredExpenses.map((e) => {
            const t = EXPENSE_THEME[e.category];
            return (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-100 transition hover:shadow-lg sm:p-5"
              >
                <div
                  className={
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl shadow " +
                    t.gradient
                  }
                >
                  {t.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 font-semibold " + t.badge
                      }
                    >
                      {t.label}
                    </span>
                    <span className="text-zinc-500">{e.occurredOn}</span>
                  </div>
                  {e.memo && (
                    <div className="mt-1 truncate text-base font-medium text-zinc-800">
                      {e.memo}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="text-xl font-bold text-rose-600 sm:text-2xl">
                    -{yen(e.amount)}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditingExpense(e)}
                      className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 active:scale-95"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingExpense(e)}
                      className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editingExpense && (
        <EditExpenseModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onDone={async () => {
            setEditingExpense(null);
            await refresh();
          }}
        />
      )}

      {deletingExpense && (
        <DeleteExpenseModal
          expense={deletingExpense}
          onClose={() => setDeletingExpense(null)}
          onDone={async () => {
            setDeletingExpense(null);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

function EditExpenseModal({
  expense,
  onClose,
  onDone,
}: {
  expense: Expense;
  onClose: () => void;
  onDone: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>(expense.category);
  const [occurredOn, setOccurredOn] = useState(expense.occurredOn);
  const [amount, setAmount] = useState<number | "">(expense.amount);
  const [memo, setMemo] = useState(expense.memo ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const theme = EXPENSE_THEME[category];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amount === "" || Number(amount) <= 0) {
      setError("金額を入力してください");
      return;
    }
    const input: UpdateExpenseInput = {
      occurredOn,
      category,
      amount: Number(amount),
      memo: memo.trim() || null,
    };
    setSubmitting(true);
    try {
      await updateExpense(expense.id, input);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-zinc-900/50 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={onSubmit}
        className="my-4 w-full max-w-md space-y-4 rounded-3xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <header className="flex items-center gap-3">
          <div
            className={
              "flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow " +
              theme.gradient
            }
          >
            {theme.emoji}
          </div>
          <div>
            <div className="text-lg font-extrabold text-zinc-900">
              支出を編集
            </div>
            <div className="text-xs text-zinc-500">{expense.occurredOn}</div>
          </div>
        </header>

        <div>
          <div className="mb-1.5 text-sm font-bold text-zinc-500">カテゴリ</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EXPENSE_CATEGORIES.map((cat) => {
              const t = EXPENSE_THEME[cat];
              const active = category === cat;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={
                    "rounded-xl px-2 py-2.5 text-sm font-medium transition " +
                    (active
                      ? "bg-gradient-to-br text-white shadow scale-105 " +
                        t.gradient
                      : "bg-white text-zinc-700 ring-1 ring-zinc-200")
                  }
                >
                  <div className="text-lg">{t.emoji}</div>
                  <div className="text-xs">{t.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">日付</div>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            金額 (円)
          </div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-lg font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </label>

        <label className="block">
          <div className="mb-1.5 text-sm font-bold text-zinc-500">
            メモ (任意)
          </div>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-base font-bold text-white shadow-lg disabled:opacity-50"
          >
            {submitting ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-700"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteExpenseModal({
  expense,
  onClose,
  onDone,
}: {
  expense: Expense;
  onClose: () => void;
  onDone: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteExpense(expense.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex justify-center text-5xl">⚠️</div>
        <div className="text-center">
          <h2 className="text-xl font-extrabold text-zinc-900">
            この支出を削除しますか？
          </h2>
          <p className="mt-3 text-sm text-zinc-600">
            <span className="font-semibold text-zinc-900">
              {expense.occurredOn} ・ -{yen(expense.amount)}
              {expense.memo && ` (${expense.memo})`}
            </span>
            <br />
            この操作は取り消せません。
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-3 text-base font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-3 text-base font-bold text-white shadow-lg disabled:opacity-50"
          >
            {submitting ? "削除中…" : "削除"}
          </button>
        </div>
      </div>
    </div>
  );
}
