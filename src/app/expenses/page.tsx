"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordExpense, type CreateExpenseInput } from "@/lib/repo";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";
import { EXPENSE_THEME } from "@/lib/theme";
import { todayIso } from "@/lib/format";
import { auth } from "@/lib/firebase";

export default function ExpenseEntryPage() {
  const router = useRouter();
  const [category, setCategory] = useState<ExpenseCategory>("party");
  const [occurredOn, setOccurredOn] = useState(todayIso());
  const [amount, setAmount] = useState<number | "">("");
  const [memo, setMemo] = useState("");
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
    const input: CreateExpenseInput = {
      occurredOn,
      category,
      amount: Number(amount),
      memo: memo.trim() || null,
      createdBy: auth.currentUser?.uid ?? null,
    };
    setSubmitting(true);
    try {
      await recordExpense(input);
      router.push("/expenses/list");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 sm:space-y-7">
      <div className="flex items-center gap-3">
        <div
          className={
            "inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-lg " +
            theme.gradient
          }
        >
          {theme.emoji}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
            支出を記録
          </h1>
          <p className="text-sm text-zinc-500 sm:text-base">
            カテゴリを選んで金額を入力
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
          カテゴリ
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {EXPENSE_CATEGORIES.map((cat) => {
            const t = EXPENSE_THEME[cat];
            const active = category === cat;
            return (
              <button
                type="button"
                key={cat}
                onClick={() => setCategory(cat)}
                className={
                  "rounded-2xl px-3 py-4 text-base font-medium transition " +
                  (active
                    ? "bg-gradient-to-br text-white shadow-lg scale-105 " +
                      t.gradient
                    : "bg-white text-zinc-700 shadow-sm hover:shadow-md hover:scale-[1.02] ring-1 " +
                      t.ring)
                }
              >
                <div className="text-2xl">{t.emoji}</div>
                <div className="mt-1.5 text-sm">{t.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <label className="block">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            日付
          </div>
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            金額 (円)
          </div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) =>
              setAmount(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            placeholder="例: 16000"
          />
        </label>

        <label className="block">
          <div className="mb-2 text-sm font-bold uppercase tracking-wider text-zinc-500">
            メモ (任意)
          </div>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="例: 打ち上げ代金、スタッフ・カメラマン代"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
          />
        </label>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-base text-rose-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4 text-lg font-bold text-white shadow-xl shadow-rose-200 transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 sm:flex-none sm:px-12"
        >
          {submitting ? "登録中…" : "登録する"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full border border-zinc-200 bg-white px-6 py-4 text-base text-zinc-700 hover:bg-zinc-50"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
