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
    weak: ['실곤약 샐러드', '아보카도 메밀김밥', '그래놀라 그릭요거트볼', '채소김밥', '생과일 컵도시락'],
    mid: ['닭가슴살 시저샐러드', '강된장 새싹비빔밥', '오리엔탈 샐러드파스타', '바질 토마토 치아바타 샌드위치', '키토김밥'],
    strong: ['우렁쌈밥정식', '지리산 산채정식', '버섯 샤브샤브', '훈제오리 월남쌈', '생연어 하와이안 포케'],
  },
  火: {
    weak: ['로제떡볶이', '순두부찌개', '사천식 마파두부덮밥', '철판 김치볶음밥', '낙지덮밥'],
    mid: ['양푼 김치찌개', '차돌박이 짬뽕', '닭볶음탕', '소갈비찜', '투움바파스타'],
    strong: ['마라탕', '핵불닭볶음면', '엽기떡볶이', '직화 쭈꾸미볶음', '매운 양념 등갈비찜'],
  },
  土: {
    weak: ['제육덮밥', '사골만두국', '장조림버터비빔밥', '간장계란밥', '닭강정'],
    mid: ['솥뚜껑 삼겹살', '왕갈비탕', '돼지국밥', '한방 약재 족발', '묵은지 뼈해장국'],
    strong: ['통오리 훈제 바베큐', '양갈비 구이', '장어구이', '석쇠 LA갈비', '안심 스테이크'],
  },
  金: {
    weak: ['연어초밥', '냉모밀 정식', '해물 빠에야', '에그베네딕트 브런치', '유부초밥 세트'],
    mid: ['전복 솥밥', '화덕 마르게리타피자', '육회비빔밥', '트러플 리조또', '장어덮밥'],
    strong: ['스시 오마카세', '카이세키', '한정식 수라상', '프렌치 파인다이닝', '푸아그라'],
  },
  水: {
    weak: ['잔치국수', '양지 쌀국수', '콩나물국밥', '새우 완탕면', '서리태 콩국수'],
    mid: ['오징어 순대', '바지락 칼국수', '소고기 낙지 연포탕', '해초 물회', '우니'],
    strong: ['대방어', '간장게장', '참치회 특선', '랍스터', '킹크랩'],
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
