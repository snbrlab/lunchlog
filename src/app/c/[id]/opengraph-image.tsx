// 커밋(한줄평) 단일 공유 카드 이미지. next/og 로 1200x630 PNG 생성.
// 터미널 톤 — /dev 감성. 이모지는 satori 런타임 fetch 의존이라 안 쓰고 CSS 도형/텍스트로.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchCommitCard } from '@/lib/share/commit-card';

export const alt = 'lunchlog 한줄평';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0d1117';
const FG = '#e6edf3';
const MUTED = '#8b949e';
const GREEN = '#3fb950';
const BORDER = '#30363d';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await fetchCommitCard(id);
  const font = await readFile(join(process.cwd(), 'assets/Pretendard-SemiBold.ttf'));

  const message = card?.message ?? '런치로그에서 한 줄 남겨보세요';
  const restaurant = card?.restaurantName ?? 'lunchlog';
  const meal = card?.mealTime === 'dinner' ? '저녁' : '점심';
  const region = card?.region ?? null;
  const hash = card?.hash ?? '';
  // 긴 한줄평은 폰트 축소 (200자 상한이라 두 단계면 충분)
  const quoteSize = message.length > 90 ? 40 : message.length > 45 ? 52 : 64;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: BG,
          color: FG,
          padding: 64,
          fontFamily: 'Pretendard',
        }}
      >
        {/* 상단 바: 신호등 + lunchlog + commit hash */}
        <div style={{ display: 'flex', alignItems: 'center', color: MUTED, fontSize: 26 }}>
          <div style={{ display: 'flex', gap: 10, marginRight: 20 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#ff5f56' }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#ffbd2e' }} />
            <div style={{ width: 18, height: 18, borderRadius: 9, background: '#27c93f' }} />
          </div>
          <div style={{ display: 'flex' }}>lunchlog</div>
          <div style={{ display: 'flex', flex: 1 }} />
          {hash ? <div style={{ display: 'flex' }}>commit {hash}</div> : null}
        </div>

        {/* 식당명 + 초록 밑줄 */}
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 44 }}>
          <div style={{ display: 'flex', fontSize: 40, color: FG }}>{restaurant}</div>
          <div style={{ display: 'flex', width: 120, height: 6, background: GREEN, marginTop: 16 }} />
        </div>

        {/* 큰 인용구 */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'center',
            fontSize: quoteSize,
            lineHeight: 1.35,
            color: FG,
            paddingRight: 40,
          }}
        >
          “{message}”
        </div>

        {/* 끼니 (작성자는 익명 — 공개 카드엔 닉네임 미노출) */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: MUTED }}>
          <div style={{ display: 'flex' }}>{meal}</div>
        </div>

        {/* 하단: 지역 + 도메인 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: 28,
            paddingTop: 24,
            borderTop: `2px solid ${BORDER}`,
            color: MUTED,
            fontSize: 26,
          }}
        >
          <div style={{ display: 'flex' }}>{region ? `${region} 근처` : '사내 점심 리뷰'}</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex' }}>lunchlog</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Pretendard', data: font, style: 'normal', weight: 600 }],
    },
  );
}
