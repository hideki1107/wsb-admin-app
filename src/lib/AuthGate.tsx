"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOut, watchAuth } from "./auth";
import { isFirebaseConfigured } from "./firebase";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (!isFirebaseConfigured) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-3xl font-bold text-transparent">
          WSB 物販・経理
        </h1>
        <p className="max-w-md text-sm text-zinc-600">
          Firebase が未設定です。<code className="rounded bg-zinc-200 px-1 text-xs">.env.local</code> を確認してください。
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-zinc-500">
        <span className="animate-pulse">読み込み中…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-6 p-6 text-center">
        <Image
          src="/icon-192.png"
          alt="WSB"
          width={96}
          height={96}
          priority
          className="h-24 w-24 rounded-2xl shadow-lg"
        />
        <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-amber-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
          WSB 物販・経理
        </h1>
        <p className="text-sm text-zinc-600">バンドメンバー専用ツール</p>
        <button
          onClick={() => signInWithGoogle()}
          className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-fuchsia-200 transition hover:scale-105 hover:shadow-2xl"
        >
          Googleでログイン
        </button>
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-white/40 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-base sm:text-lg transition hover:opacity-80 active:opacity-60"
            aria-label="ダッシュボードへ"
          >
            <Image
              src="/icon-192.png"
              alt="WSB"
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-lg shadow-sm sm:h-10 sm:w-10"
            />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text font-extrabold text-transparent">
              WSB 物販・経理
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3 text-sm text-zinc-600">
            <span className="hidden sm:inline">
              {user.displayName ?? user.email}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs sm:text-sm hover:bg-zinc-50"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>
      {children}
    </>
  );
}
