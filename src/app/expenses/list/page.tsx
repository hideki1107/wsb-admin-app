"use client";

import { useEffect, useState } from "react";
import { deleteExpense, listExpenses } from "@/lib/repo";
import { type Expense } from "@/lib/types";
import { EXPENSE_THEME } from "@/lib/theme";
import { yen } from "@/lib/format";

export default function ExpensesListPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

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

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
          支出一覧
        </h1>
        <p className="mt-1 text-base text-zinc-500">
          {expenses.length}件 ・ 合計
          <span className="ml-1 font-bold text-rose-600">
            -{yen(total)}
          </span>
        </p>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-base text-zinc-500 shadow-md">
          まだ記録がありません
        </div>
      ) : (
        <ul className="space-y-2.5">
          {expenses.map((e) => {
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
                  <button
                    type="button"
                    onClick={() => setDeletingExpense(e)}
                    className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 active:scale-95"
                    aria-label="削除"
                  >
                    削除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
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
