import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthGate } from "@/lib/AuthGate";
import { NavBar } from "@/components/NavBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WSB管理",
  description: "WSB バンドの物販・収入支出・在庫管理アプリ",
  manifest: "/manifest.json",
  applicationName: "WSB管理",
  appleWebApp: {
    capable: true,
    title: "WSB管理",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
  // ホーム画面起動時にステータスバーやノッチを避ける
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50 text-zinc-900">
        {/* 装飾的ぼかし */}
        <div
          aria-hidden
          className="pointer-events-none fixed -top-32 -left-32 h-96 w-96 rounded-full bg-fuchsia-300 opacity-30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed top-1/3 -right-32 h-96 w-96 rounded-full bg-violet-300 opacity-30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none fixed -bottom-32 left-1/3 h-96 w-96 rounded-full bg-amber-200 opacity-30 blur-3xl"
        />

        <div className="relative z-10 flex min-h-screen flex-col text-base sm:text-[17px]">
          <AuthGate>
            <NavBar />
            <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
              {children}
            </main>
          </AuthGate>
        </div>
      </body>
    </html>
  );
}
