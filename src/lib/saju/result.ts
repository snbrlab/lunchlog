// SajuResult → 화면에 뿌릴 최종 결과 조립 (메뉴 + 궁합 + 성격 + 분포).
import type { Element } from './menus';
import { ELEMENT_META, pickMenu } from './menus';
import type { SajuResult } from './calc';
import { AXIS_PERSONA, SEASON_LABEL, SEASON_TEMP } from './personality';

// 오행 상생(生): 水→木→火→土→金→水. "나를 生하는"(살리는) = 나의 앞 오행.
const GENERATOR: Record<Element, Element> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
// 오행 상극(克): 나를 克하는(누르는/식히는) 오행. 金克木·水克火·木克土·火克金·土克水.
const CONTROLLER: Record<Element, Element> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };

const ELEMENT_MENU_HINT: Record<Element, string> = {
  木: '산뜻한 채소',
  火: '매콤한 것',
  土: '든든한 고기',
  金: '정갈한 일식',
  水: '시원한 국물',
};

export interface SajuView {
  palja: string;
  element: Element;
  elementEmoji: string;
  elementLabel: string; // "🔥 火 뜨겁고 매움"
  strengthLabel: string; // 기본형/진화형/최종진화
  menu: string; // 운명의 점심
  personaLabel: string; // 자기주도형 등
  personaLine: string;
  seasonLabel: string;
  seasonTemp: string;
  // 궁합 메뉴 (상생/상극)
  boostElement: Element;
  boostMenu: string;
  coolElement: Element;
  coolMenu: string;
  // 오행 분포 (차트)
  distribution: { element: Element; emoji: string; count: number; percent: number }[];
  // 우리 식당 매칭용 — 이 오행 장르에 해당하는 cuisine 후보 (page 에서 식당 조회)
  cuisineHints: string[];
}

const ORDER: Element[] = ['木', '火', '土', '金', '水'];

// 오행별 우리 cuisine_types 매칭 힌트 (식당 추천 쿼리에 사용)
export const CUISINE_BY_ELEMENT: Record<Element, string[]> = {
  木: ['샐러드', '한식', '분식', '아시아'],
  火: ['중식', '분식', '한식', '아시아'],
  土: ['고기', '한식', '치킨'],
  金: ['일식', '양식'],
  水: ['해산물', '한식', '분식'],
};

export function buildSajuView(r: SajuResult): SajuView {
  const el = r.dayElement;
  const meta = ELEMENT_META[el];
  const menu = pickMenu(el, r.strength, r.seed);
  const persona = AXIS_PERSONA[r.dominantAxis];

  const boost = GENERATOR[el];
  const cool = CONTROLLER[el];

  const total = ORDER.reduce((s, e) => s + r.counts[e], 0) || 1;

  const strengthLabel = { weak: '기본형', mid: '진화형', strong: '최종진화' }[r.strength];

  return {
    palja: r.palja,
    element: el,
    elementEmoji: meta.emoji,
    elementLabel: `${meta.emoji} ${el} ${meta.label}`,
    strengthLabel,
    menu,
    personaLabel: persona.label,
    personaLine: persona.line,
    seasonLabel: SEASON_LABEL[r.season],
    seasonTemp: SEASON_TEMP[r.season],
    boostElement: boost,
    boostMenu: `${ELEMENT_MENU_HINT[boost]} — ${pickMenu(boost, 'mid', r.seed + 1)}`,
    coolElement: cool,
    coolMenu: `${ELEMENT_MENU_HINT[cool]} — ${pickMenu(cool, 'mid', r.seed + 2)}`,
    distribution: ORDER.map((e) => ({
      element: e,
      emoji: ELEMENT_META[e].emoji,
      count: r.counts[e],
      percent: Math.round((r.counts[e] / total) * 100),
    })),
    cuisineHints: CUISINE_BY_ELEMENT[el],
  };
}
