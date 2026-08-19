import type { Metadata } from 'next';
import SajuApp from './SajuApp';

export const metadata: Metadata = {
  title: '운명의 점심 — lunchlog',
  description: '사주(만세력)로 보는 오늘의 운명 점심 메뉴',
  robots: { index: false, follow: false },
};

// 공개 페이지 — 로그인 불필요. 생년월일은 브라우저에서만 계산(서버 전송/저장 없음).
export default function SajuPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md px-5 py-10">
      <SajuApp />
    </main>
  );
}
