// SajuResult → 화면에 뿌릴 최종 결과 조립 (메뉴 + 궁합 + 성격 + 분포).
import type { Element } from './menus';
import { ELEMENT_META, pickMenu, STRENGTH_LABEL } from './menus';
import type { Pillar, SajuResult } from './calc';
import { AXIS_PERSONA, SEASON_LABEL, SEASON_TEMP } from './personality';
import {
  ELEMENT_TRAIT,
  STEM_POETIC,
  EATER,
  STRENGTH_LINE,
  AXIS_KO,
  SEASON_KO,
  TIME_PERSONA,
  YINYANG_LINE,
} from './copy';

// 오행 상생(生): 水→木→火→土→金→水. "나를 生하는"(살리는) = 나의 앞 오행.
const GENERATOR: Record<Element, Element> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
// 오행 상극(克): 나를 克하는(누르는/식히는) 오행. 金克木·水克火·木克土·火克金·土克水.
const CONTROLLER: Record<Element, Element> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };

// 오행 무드 형용사 — 궁합 메뉴 앞 수식 (메뉴가 다양해도 안 어긋나게 형용사만).
const ELEMENT_MENU_HINT: Record<Element, string> = {
  木: '산뜻한',
  火: '매콤한',
  土: '든든한',
  金: '정갈한',
  水: '시원한',
};

export interface SajuView {
  palja: string;
  pillars: Pillar[];
  element: Element;
  elementEmoji: string;
  elementLabel: string; // "🔥 火 뜨겁고 매움"
  strengthLabel: string; // 은은한/균형잡힌/묵직한
  strengthLine: string;
  menu: string; // 운명의 메뉴
  // 성향 해석
  dayGanKo: string; // 병
  dayGan: string; // 丙
  stemPoetic: string; // "사방을 비추는 해"
  eaterBody: string[]; // 먹는 스타일 3줄
  eaterStrength: string;
  eaterCaution: string;
  eaterMate: string;
  personaLabel: string; // 자기주도형 등
  personaLine: string;
  yinYangLine: string; // 음양 기울기 한 줄
  timeLine: string | null; // 태어난 시 기운 한 줄 (시각 입력 시)
  dominantTraits: { label: string; el: Element }[]; // 두드러지는 성향 2
  reasons: string[]; // 왜 이 메뉴일까
  seasonLabel: string;
  seasonTemp: string;
  // 궁합 메뉴 (상생/상극)
  boostElement: Element;
  boostMenu: string;
  coolElement: Element;
  coolMenu: string;
  // 오행 분포 (차트)
  distribution: { element: Element; emoji: string; trait: string; count: number; percent: number }[];
  lackLine: string; // 없는/부족 기운 안내
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
  const eater = EATER[el];

  const boost = GENERATOR[el];
  const cool = CONTROLLER[el];

  const total = ORDER.reduce((s, e) => s + r.counts[e], 0) || 1;
  const strengthLabel = STRENGTH_LABEL[r.strength];

  // "왜 이 메뉴일까" — 사주 근거들
  const reasons: string[] = [
    `타고난 기운이 ${meta.label.split('·')[0]?.trim()}인 ${el}(${ELEMENT_META[el].emoji}) 쪽이라, 그 결의 메뉴가 잘 맞아요.`,
    r.counts[el] >= 2
      ? `사주에 ${el} 기운이 ${r.counts[el]}개로 두드러진 ${strengthLabel} 기운이에요.`
      : `${el} 기운이 은은한 편이라 순한 쪽부터 어울려요.`,
    `${SEASON_KO[r.season]}에 태어나 ${SEASON_TEMP[r.season]}을 타고났어요.`,
    r.lackIsNone
      ? '다섯 기운이 골고루 있어 균형 잡힌 입맛이에요.'
      : `${r.lackElement}(${ELEMENT_META[r.lackElement].emoji}) 기운이 부족해, 그쪽으로 곁들이면 밸런스가 좋아요.`,
    `${AXIS_KO[r.dominantAxis]} 성향이 두드러지는 배치예요.`,
  ];

  const lackLine = r.lackIsNone
    ? '다섯 기운이 모두 있어요. 어느 한쪽으로 크게 치우치지 않은 균형형이에요.'
    : `${r.lackElement}(${ELEMENT_META[r.lackElement].emoji}) 기운이 가장 얇아요. 궁합 메뉴로 채우면 좋아요.`;

  return {
    palja: r.palja,
    pillars: r.pillars,
    element: el,
    elementEmoji: meta.emoji,
    elementLabel: `${meta.emoji} ${el} ${meta.label}`,
    strengthLabel,
    strengthLine: STRENGTH_LINE[r.strength],
    menu,
    dayGanKo: r.dayGanKo,
    dayGan: r.dayGan,
    stemPoetic: STEM_POETIC[r.dayGan] ?? '',
    eaterBody: eater.body,
    eaterStrength: eater.strength,
    eaterCaution: eater.caution,
    eaterMate: eater.mate,
    personaLabel: persona.label,
    personaLine: persona.line,
    yinYangLine: YINYANG_LINE[r.yinYangTilt],
    timeLine: r.timeZhi ? (TIME_PERSONA[r.timeZhi] ?? null) : null,
    dominantTraits: r.dominantAxes.map((ax) => ({ label: AXIS_KO[ax], el })),
    reasons,
    seasonLabel: SEASON_LABEL[r.season],
    seasonTemp: SEASON_TEMP[r.season],
    boostElement: boost,
    boostMenu: `${ELEMENT_MENU_HINT[boost]} — ${pickMenu(boost, 'mid', r.seed + 1)}`,
    coolElement: cool,
    coolMenu: `${ELEMENT_MENU_HINT[cool]} — ${pickMenu(cool, 'mid', r.seed + 2)}`,
    distribution: ORDER.map((e) => ({
      element: e,
      emoji: ELEMENT_META[e].emoji,
      trait: ELEMENT_TRAIT[e],
      count: r.counts[e],
      percent: Math.round((r.counts[e] / total) * 100),
    })),
    lackLine,
    cuisineHints: CUISINE_BY_ELEMENT[el],
  };
}
