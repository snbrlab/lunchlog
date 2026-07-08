// 커밋(한줄평) 공유 랜딩 — 인증 밖 공개 페이지.
// 카톡/슬랙 링크의 목적지. og:image 는 같은 세그먼트의 opengraph-image.tsx 로 자동 첨부.
// 사람에겐 한줄평 카드 + "지도에서 보기" (클릭 시 /map → 비로그인이면 로그인 유도).

import Link from 'next/link';
import type { Metadata } from 'next';
import { fetchCommitCard } from '@/lib/share/commit-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = await fetchCommitCard(id);
  // noindex — 공개 공유 링크지만 검색엔진 색인은 막음 (한줄평이 검색에 뜨지 않게)
  const robots = { index: false, follow: false };
  if (!card) return { title: 'lunchlog', robots };
  const title = `${card.restaurantName} — lunchlog`;
  const description = `“${card.message}”`; // 작성자 닉네임 미포함 (익명 공개)
  // og:image 는 파일 컨벤션(opengraph-image.tsx)이 자동 주입. 여기선 title/description 만.
  return { title, description, robots, openGraph: { title, description } };
}

export default async function CommitSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await fetchCommitCard(id);

  return (
    <div
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
      className="flex min-h-dvh flex-col items-center justify-center bg-[#0d1117] px-6 py-16 text-[#e6edf3]"
    >
      <div className="w-full max-w-md rounded-lg border border-[#30363d] bg-[#0d1117] shadow-xl">
        {/* 터미널 상단 바 */}
        <div className="flex items-center gap-2 border-b border-[#30363d] px-4 py-2.5 text-[12px] text-[#8b949e]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2">lunchlog</span>
          {card ? <span className="ml-auto">commit {card.hash}</span> : null}
        </div>

        <div className="px-6 py-7">
          {card ? (
            <>
              <div className="text-lg font-semibold">{card.restaurantName}</div>
              <div className="mt-2 h-1.5 w-16 bg-[#3fb950]" />
              <p className="mt-6 text-2xl leading-relaxed">“{card.message}”</p>
              <div className="mt-5 text-[15px] text-[#8b949e]">
                {card.mealTime === 'dinner' ? '저녁' : '점심'}
                {card.region ? ` · ${card.region} 근처` : ''}
              </div>
              <Link
                href={`/map?focus=${card.restaurantId}`}
                className="mt-8 flex w-full items-center justify-center rounded-md border border-[#3fb950]/40 bg-[#3fb950]/10 px-4 py-2.5 text-center text-[15px] text-[#3fb950] transition hover:bg-[#3fb950]/20"
              >
                $ 지도에서 보기 →
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg">이 한줄평은 사라졌어요.</p>
              <p className="mt-2 text-[14px] text-[#8b949e]">
                삭제됐거나 되돌려진 리뷰일 수 있어요.
              </p>
              <Link
                href="/map"
                className="mt-8 flex w-full items-center justify-center rounded-md border border-[#3fb950]/40 bg-[#3fb950]/10 px-4 py-2.5 text-center text-[15px] text-[#3fb950] transition hover:bg-[#3fb950]/20"
              >
                $ lunchlog 둘러보기 →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
