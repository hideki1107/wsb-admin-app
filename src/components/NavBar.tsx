"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems: { href: string; label: string; emoji: string }[] = [
  { href: "/", label: "ダッシュボード", emoji: "✨" },
  { href: "/inventory", label: "在庫", emoji: "📦" },
  { href: "/sales/list", label: "収入一覧", emoji: "📈" },
  { href: "/expenses/list", label: "支出一覧", emoji: "📉" },
];

export function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-20 border-b border-white/40 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* ハンバーガー (モバイルのみ) */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100 sm:hidden"
          aria-label="メニュー"
          aria-expanded={open}
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>

        {/* デスクトップ用ナビタブ */}
        <div className="hidden flex-1 gap-1.5 sm:flex">
          {navItems.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={
                  "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-base font-semibold whitespace-nowrap transition-all " +
                  (active
                    ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-fuchsia-200"
                    : "text-zinc-700 hover:bg-white hover:text-zinc-900 hover:shadow-sm")
                }
              >
                <span className="text-lg">{it.emoji}</span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>

        {/* モバイル: ハンバーガーと action ボタンの間のスペーサー */}
        <div className="flex-1 sm:hidden" />

        {/* 右端: アクションボタン (常時表示) */}
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Link
            href="/sales"
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-fuchsia-200 transition hover:scale-105 active:scale-95 sm:px-4 sm:text-base"
          >
            <span>＋</span>
            <span>収入</span>
          </Link>
          <Link
            href="/expenses"
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-rose-200 transition hover:scale-105 active:scale-95 sm:px-4 sm:text-base"
          >
            <span>＋</span>
            <span>支出</span>
          </Link>
          <Link
            href="/stock-in"
            className="flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:scale-105 active:scale-95 sm:px-4 sm:text-base"
          >
            <span>＋</span>
            <span>在庫</span>
          </Link>
        </div>
      </div>

      {/* モバイル: ハンバーガーで開閉するナビ */}
      {open && (
        <div className="border-t border-zinc-100 bg-white/95 sm:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-3 py-3">
            {navItems.map((it) => {
              const active = pathname === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition " +
                    (active
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow"
                      : "text-zinc-700 hover:bg-zinc-100")
                  }
                >
                  <span className="text-xl">{it.emoji}</span>
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
