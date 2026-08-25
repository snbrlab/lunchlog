// 운명의 점심(사주) 공유 랜딩 — 비로그인 공개. 카톡/슬랙 링크의 목적지.
// og:image 는 같은 세그먼트 opengraph-image.tsx 가 자동 첨부. 결과는 URL code 에서 복원.
import Link from 'next/link';
import type { Metadata } from 'next';
import { decodeSaju } from '@/lib/saju/share';
import { buildSajuView } from '@/lib/saju/result';
import { ELEMENT_META } from '@/lib/saju/menus';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const r = decodeSaju(code);
  const robots = { index: false, follow: false }; // 개인 결과 — 검색 색인 막음
  if (!r) return { title: '운명의 점심 — lunchlog', robots };
  const v = buildSajuView(r);
  const title = `운명의 점심: ${v.menu} — lunchlog`;
  const description = `${v.elementLabel} · ${v.strengthLabel} 기운. ${v.stemPoetic}`;
  return { title, description, robots, openGraph: { title, description } };
}

export default async function SajuSharePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const r = decodeSaju(code);
  const v = r ? buildSajuView(r) : null;
  const accent = v ? ELEMENT_META[v.element].color : '#3fb950';

  return (
    <div
      style={{ fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}
      className="flex min-h-dvh flex-col items-center justify-center bg-[#0d1117] px-6 py-16 text-[#e6edf3]"
    >
      <div className="w-full max-w-md rounded-lg border border-[#30363d] bg-[#0d1117] shadow-xl">
        <div className="flex items-center gap-2 border-b border-[#30363d] px-4 py-2.5 text-[12px] text-[#8b949e]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          <span className="ml-2">🔮 운명의 점심</span>
        </div>

        <div className="px-6 py-7">
          {v ? (
            <>
              <div className="text-center text-5xl">{v.elementEmoji}</div>
              <p className="mt-3 text-center text-[13px] text-[#8b949e]">누군가의 운명의 메뉴</p>
              <p className="mt-1 text-center text-3xl font-extrabold" style={{ color: accent }}>
                {v.menu}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5 text-[12px] text-[#8b949e]">
                <span className="rounded-full border border-[#30363d] px-2.5 py-1">{v.elementLabel}</span>
                <span className="rounded-full border border-[#30363d] px-2.5 py-1">{v.strengthLabel} 기운</span>
                <span className="rounded-full border border-[#30363d] px-2.5 py-1">{v.seasonLabel} 기운</span>
              </div>

              <div className="mt-6 rounded-lg bg-white/[0.03] p-4">
                <p className="text-[12px] text-[#8b949e]">일간 {v.dayGanKo}({v.dayGan})</p>
                <p className="mt-1 text-[15px] font-bold">{v.stemPoetic}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-[#8b949e]">{v.strengthLine}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b949e]">{v.yinYangLine}</p>
                {v.timeLine && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#8b949e]">⏱ {v.timeLine}</p>
                )}
              </div>

              <Link
                href="/saju"
                className="mt-7 flex w-full items-center justify-center rounded-md border border-[#3fb950]/40 bg-[#3fb950]/10 px-4 py-2.5 text-center text-[15px] text-[#3fb950] transition hover:bg-[#3fb950]/20"
              >
                $ 나도 내 점심사주 보기 →
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg">결과를 불러올 수 없어요.</p>
              <p className="mt-2 text-[14px] text-[#8b949e]">링크가 잘못됐거나 손상됐을 수 있어요.</p>
              <Link
                href="/saju"
                className="mt-8 flex w-full items-center justify-center rounded-md border border-[#3fb950]/40 bg-[#3fb950]/10 px-4 py-2.5 text-center text-[15px] text-[#3fb950] transition hover:bg-[#3fb950]/20"
              >
                $ 내 점심사주 보기 →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
