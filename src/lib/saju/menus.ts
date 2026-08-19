// 운명의 점심 도감 — 오행(5) × 세기(약/중/강) = 15칸, 칸당 후보 5개.
// 최종 메뉴는 팔자의 나머지 축(음양·일지·월지)을 seed 로 후보 중 하나를 결정론적으로 뽑는다.
// (같은 생일 = 같은 결과 → "운명" 느낌)

export type Element = '木' | '火' | '土' | '金' | '水';
export type Strength = 'weak' | 'mid' | 'strong';

export const ELEMENT_META: Record<
  Element,
  { emoji: string; ko: string; label: string; color: string }
> = {
  木: { emoji: '🌳', ko: '목', label: '산뜻·가벼움', color: '#4caf50' },
  火: { emoji: '🔥', ko: '화', label: '뜨겁고 매움', color: '#e53935' },
  土: { emoji: '🥩', ko: '토', label: '육류·든든', color: '#a1642d' },
  金: { emoji: '🍣', ko: '금', label: '비싸고 정갈', color: '#c9a227' },
  水: { emoji: '🌊', ko: '수', label: '해산물·국물', color: '#1e88e5' },
};

export const STRENGTH_LABEL: Record<Strength, string> = {
  weak: '기본형',
  mid: '진화형',
  strong: '최종진화',
};

// 일간 오행이 팔자에 몇 개인가로 세기 판정
export function strengthOf(dayElementCount: number): Strength {
  if (dayElementCount >= 4) return 'strong';
  if (dayElementCount >= 2) return 'mid';
  return 'weak';
}

// 15칸 × 5후보 = 75
export const MENU_POOL: Record<Element, Record<Strength, string[]>> = {
  木: {
    weak: ['샐러드', '연어포케', '그릭요거트볼', '샌드위치', '과일도시락'],
    mid: ['비빔밥', '월남쌈', '냉파스타', '두부덮밥', '채소라멘'],
    strong: ['브런치 한상', '샐러드바', '채식뷔페', '비건버거', '나물정식'],
  },
  火: {
    weak: ['로제떡볶이', '순한 짬뽕', '마파두부', '김치볶음밥', '낙지덮밥'],
    mid: ['김치찌개', '짬뽕', '매운 갈비찜', '닭볶음탕', '쭈꾸미볶음'],
    strong: ['마라탕', '핵불닭', '엽기떡볶이', '불냉면', '매운 등갈비'],
  },
  土: {
    weak: ['제육덮밥', '닭갈비', '불고기', '소불고기덮밥', '닭강정'],
    mid: ['삼겹살', '갈비탕', '돼지국밥', '족발', '보쌈'],
    strong: ['한우구이', '갈비 무한리필', '소고기 한상', 'LA갈비', '스테이크'],
  },
  金: {
    weak: ['초밥 런치', '우동', '소바', '유부초밥', '연어덮밥'],
    mid: ['일식정식', '텐동', '돈카츠', '규동', '회덮밥'],
    strong: ['오마카세', '스시 코스', '파인다이닝', '카이세키', '한정식 코스'],
  },
  水: {
    weak: ['잔치국수', '어묵탕', '칼국수', '조개탕', '들깨수제비'],
    mid: ['냉면', '해물칼국수', '순대국', '물회', '해물파전'],
    strong: ['해물탕', '대게찜', '사골곰탕', '회코스', '킹크랩'],
  },
};

// 부족(가장 적은) 오행 → 곁들이 처방
export const SIDE_BY_LACK: Record<Element, string> = {
  木: '산뜻한 거 곁들여요 (샐러드·나물 한 접시)',
  火: '매콤한 거 하나 추가하면 밸런스 UP',
  土: '고기 한 점 / 공기밥 추가',
  金: '깔끔한 초밥 한 점이나 담백한 국물',
  水: '국물 있는 걸로 / 물 넉넉히',
};

// 후보 중 하나를 결정론적으로 선택 (seed = 음양·일지·월지 등 팔자 나머지 축의 합)
export function pickMenu(element: Element, strength: Strength, seed: number): string {
  const pool = MENU_POOL[element][strength];
  return pool[((seed % pool.length) + pool.length) % pool.length]!;
}
