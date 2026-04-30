import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "런치로그",
  description: "가본 곳에 한 줄 평 남기기",
  robots: { index: false, follow: false },
};

// localStorage 의 점심/저녁 모드를 첫 paint 전에 적용해 FOUC 방지.
// SSR 은 항상 lunch 로 렌더되므로, hydration 직전에 dinner 면 즉시 전환.
const MODE_BOOT_SCRIPT = `
(function(){
  try {
    var m = localStorage.getItem('lastMealMode');
    if (m !== 'lunch' && m !== 'dinner') m = 'lunch';
    document.documentElement.dataset.mode = m;
  } catch (e) {
    document.documentElement.dataset.mode = 'lunch';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* 부트 스크립트가 paint 전에 dataset.mode 박음. jsx 에 박지 않는 이유: hydration mismatch 회피 (next-themes 패턴) */}
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
