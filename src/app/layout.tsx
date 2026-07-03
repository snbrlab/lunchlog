import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// siteUrl 만 필요 — throw 하는 env.ts(publicEnv) 를 root layout 에 끌어오면
// 모든 페이지가 빌드타임 env 에 하드의존하므로 fallback 있는 값만 직접 읽음.
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lunchlog-rho.vercel.app"
).replace(/\/$/, "");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL), // /c/[id] 공유 카드 og:image 절대 URL 해석용
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
        {/* D65: Kakao 지도 SDK 도메인 미리 연결 — HTML 파싱과 병렬로 DNS/TCP/TLS
            수립해서 /map 첫 지도 표시 100~300ms 단축 */}
        <link rel="preconnect" href="https://dapi.kakao.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://dapi.kakao.com" />
        {/* 부트 스크립트가 paint 전에 dataset.mode 박음. jsx 에 박지 않는 이유: hydration mismatch 회피 (next-themes 패턴) */}
        <script dangerouslySetInnerHTML={{ __html: MODE_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-fg">{children}</body>
    </html>
  );
}
