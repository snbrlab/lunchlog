// 운명의 점심(사주) 공유 카드 — next/og 로 1200x630 PNG. 냄비 + 메뉴 + 오행/세기 + 성향.
// 결과는 URL code 에 담겨 옴 (DB/로그인 없음). 생년월일은 담기지 않는다.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeSaju } from '@/lib/saju/share';
import { buildSajuView } from '@/lib/saju/result';
import { ELEMENT_META, type Element } from '@/lib/saju/menus';

export const alt = '나의 운명의 점심 메뉴';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#0d1117';
const FG = '#e6edf3';
const MUTED = '#8b949e';
const BORDER = '#30363d';

// 오행 재료 이모지 (SajuApp 과 동일)
const INGREDIENT: Record<Element, string> = { 木: '🥬', 火: '🌶️', 土: '🍖', 金: '🧂', 水: '🐟' };
const ORDER: Element[] = ['木', '火', '土', '金', '水'];

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const font = await readFile(join(process.cwd(), 'assets/Pretendard-SemiBold.ttf'));
  const r = decodeSaju(code);

  // 코드가 깨졌으면 안내 카드
  if (!r) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BG, color: FG, fontFamily: 'Pretendard', fontSize: 44 }}>
          🔮 운명의 점심 · lunchlog
        </div>
      ),
      { ...size, fonts: [{ name: 'Pretendard', data: font, style: 'normal', weight: 600 }] },
    );
  }

  const v = buildSajuView(r);
  const accent = ELEMENT_META[v.element].color;

  // 성향 문구 (있는 것만)
  const traits = [v.strengthLine, v.yinYangLine, v.timeLine].filter(Boolean) as string[];

  // 냄비 재료 — 오행 count 로 크기 차등 (많을수록 큼). count 0 이면 작게.
  const ingredients = ORDER.map((el) => ({
    emoji: INGREDIENT[el],
    fontSize: 34 + Math.min(r.counts[el], 6) * 8,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: BG, color: FG, fontFamily: 'Pretendard', padding: 56,
        }}
      >
        {/* 상단 바 */}
        <div style={{ display: 'flex', alignItems: 'center', color: MUTED, fontSize: 26 }}>
          <div style={{ display: 'flex', marginRight: 14, fontSize: 30 }}>🔮</div>
          <div style={{ display: 'flex' }}>운명의 점심</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex' }}>lunchlog</div>
        </div>

        <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: 48, marginTop: 8 }}>
          {/* 왼쪽: 냄비 + 오행 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 440 }}>
            <div style={{ display: 'flex', position: 'relative', width: 400, height: 220 }}>
              {/* 냄비 몸통 */}
              <div style={{ display: 'flex', position: 'absolute', top: 66, left: 20, width: 360, height: 140, background: 'linear-gradient(#484850, #232327)', borderRadius: '0 0 64px 64px' }} />
              {/* 림 */}
              <div style={{ display: 'flex', position: 'absolute', top: 48, left: 10, width: 380, height: 64, borderRadius: '50%', background: '#36363c' }} />
              {/* 국물 */}
              <div style={{ display: 'flex', position: 'absolute', top: 16, left: 40, width: 320, height: 128, borderRadius: '50%', background: 'radial-gradient(circle at 50% 40%, #fdf5e2, #e4d0a2)', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', padding: 22 }}>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ display: 'flex', fontSize: ing.fontSize }}>{ing.emoji}</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: FG }}>{v.elementLabel}</div>
            <div style={{ display: 'flex', marginTop: 8, fontSize: 26, color: MUTED }}>{v.strengthLabel} 기운 · {v.seasonLabel}</div>
          </div>

          {/* 오른쪽: 메뉴 + 성향 */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>당신의 운명의 메뉴</div>
            <div style={{ display: 'flex', fontSize: v.menu.length > 8 ? 60 : 72, fontWeight: 700, color: accent, marginTop: 6, marginBottom: 22 }}>{v.menu}</div>
            <div style={{ display: 'flex', fontSize: 24, color: FG, marginBottom: 4 }}>일간 {v.dayGanKo}({v.dayGan}) · {v.stemPoetic}</div>
            {traits.map((t, i) => (
              <div key={i} style={{ display: 'flex', fontSize: 23, color: MUTED, lineHeight: 1.5, marginTop: 8, paddingRight: 12 }}>{t}</div>
            ))}
          </div>
        </div>

        {/* 하단 */}
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20, borderTop: `2px solid ${BORDER}`, color: MUTED, fontSize: 24 }}>
          <div style={{ display: 'flex' }}>사주로 보는 오늘의 점심</div>
          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex' }}>나도 해보기 → lunchlog</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Pretendard', data: font, style: 'normal', weight: 600 }] },
  );
}
