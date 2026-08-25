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
  weak: '은은한',
  mid: '균형잡힌',
  strong: '묵직한',
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
    weak: ['리코타 치즈 샐러드', '새싹비빔밥', '생과일 컵도시락', '그래놀라 그릭요거트볼', '서리태 콩국수'],
    mid: ['오리엔탈 샐러드파스타', '우렁 강된장 쌈밥', '바질 토마토 치아바타', '아보카도 메밀김밥', '도토리묵사발'],
    strong: ['무한리필 월남쌈', '명란 아보카도 덮밥', '미나리 샤브샤브', '훈제오리 키토김밥', '곤드레 가마솥밥'],
  },
  火: {
    weak: ['순두부찌개', '로제떡볶이', '철판 김치볶음밥', '투움바파스타', '닭볶음탕'],
    mid: ['양푼 김치찌개', '기름떡볶이', '사천식 마파두부덮밥', '차돌박이 짬뽕', '숯불 무뼈 닭발'],
    strong: ['마라탕', '엽기떡볶이', '직화 쭈꾸미볶음', '핵불닭볶음면', '매운 양념 등갈비찜'],
  },
  土: {
    weak: ['제육덮밥', '사골만두국', '장조림버터비빔밥', '간장계란밥', '함박스테이크'],
    mid: ['동파육', '왕갈비탕', '한방 약재 족발', '불고기 전골', '소갈비찜'],
    strong: ['우대갈비', '한우 곱창 전골', '솥뚜껑 삼겹살', '통오리 훈제 바베큐', '묵은지 뼈감자탕'],
  },
  金: {
    weak: ['연어초밥', '텐동', '전복 영양솥밥', '에그베네딕트 브런치', '트러플 크림파스타'],
    mid: ['장어덮밥', '규카츠 정식', '구절판', '화덕 마르게리타피자', '해물 빠에야'],
    strong: ['스시 오마카세', '카이세키', '궁중 신선로', '랍스터 테일 구이', '벨루가 캐비어 플레이트'],
  },
  水: {
    weak: ['잔치국수', '삼치구이', '오징어 순대', '어묵우동', '콩나물국밥'],
    mid: ['바지락 칼국수', '보리굴비정식', '간장게장', '항아리 물회', '밀푀유나베'],
    strong: ['대방어', '갈치조림', '참치회 특선', '아구찜', '킹크랩'],
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
