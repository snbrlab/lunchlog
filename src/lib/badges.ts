// D70: 작성자 뱃지 메타데이터.
// DB user_badges.code → 라벨/이모지/설명 매핑.
// 노티 페이로드엔 code 만 들고, UI 에서 여기로 lookup.

export interface BadgeMeta {
  code: string;
  emoji: string;
  label: string;
  axis: string;        // 같은 axis 내 더 높은 tier 받으면 낮은 tier 는 도감에서 흐림
  tier: number;        // 1이 최저
  threshold: number;   // 자격 임계 (디스플레이 + "N 남음" 계산용)
  unit: string;        // 임계 단위 (예: 'commit', '일 streak', '곳' 등)
  description: string;
}

// 13개 cuisine 그룹 (D27/D61)
export const CUISINE_GROUP_LABELS = [
  '한식','일식','중식','양식','아시아','고기','해산물','치킨','피자',
  '카페·디저트','술집','뷔페','기타',
] as const;

export const BADGES: readonly BadgeMeta[] = [
  // A. 활동량
  { code: 'commits_1',   emoji: '🌱', label: 'git init',                    axis: 'commits', tier: 1, threshold: 1,   unit: 'commit', description: '런치로그에 첫 발을 내딛은 당신' },
  { code: 'commits_10',  emoji: '🌿', label: '새싹',                        axis: 'commits', tier: 2, threshold: 10,  unit: 'commit', description: '이제 시작이지 — commit 10' },
  { code: 'commits_50',  emoji: '🌳', label: '주니어',                      axis: 'commits', tier: 3, threshold: 50,  unit: 'commit', description: '단골 입문 — commit 50' },
  { code: 'commits_100', emoji: '🌲', label: '시니어',                      axis: 'commits', tier: 4, threshold: 100, unit: 'commit', description: '꽤 진심이시네요 — commit 100' },
  { code: 'commits_500', emoji: '🏔️', label: '고인물을 넘어선 무언가',      axis: 'commits', tier: 5, threshold: 500, unit: 'commit', description: '더는 막을 수 없음 — commit 500' },

  // B. 꾸준함
  { code: 'streak_3',   emoji: '🔥', label: '작심삼일은 넘겼다',             axis: 'streak', tier: 1, threshold: 3,   unit: '일 streak', description: '3일 연속! 일단 작삼은 통과' },
  { code: 'streak_7',   emoji: '🗓️', label: '주간 개근',                    axis: 'streak', tier: 2, threshold: 7,   unit: '일 streak', description: '7일 연속 — 한 주 무결근' },
  { code: 'streak_30',  emoji: '📅', label: '월간 개근',                    axis: 'streak', tier: 3, threshold: 30,  unit: '일 streak', description: '30일 연속 — 한 달 무결근' },
  { code: 'streak_100', emoji: '🐻', label: '마늘 대신 커밋 먹고 사람 됨',   axis: 'streak', tier: 4, threshold: 100, unit: '일 streak', description: '쑥과 마늘 대신 commit 100일' },

  // C. 개척
  { code: 'pioneer_3',  emoji: '🚩', label: '탐험가',                       axis: 'pioneer', tier: 1, threshold: 3,  unit: '곳', description: '혼자만 깃발 꽂은 곳 3개 — 발자국' },
  { code: 'pioneer_10', emoji: '🧭', label: '개척자',                       axis: 'pioneer', tier: 2, threshold: 10, unit: '곳', description: '아무도 모르는 곳 10개 발견' },
  { code: 'pioneer_50', emoji: '👑', label: '이 구역은 내 땅',               axis: 'pioneer', tier: 3, threshold: 50, unit: '곳', description: '50곳 단독 깃발 — 이 구역은 내 땅' },

  // E. 다양성
  { code: 'cuisines_5',  emoji: '🗺️', label: '편식은 안 해요',             axis: 'cuisines', tier: 1, threshold: 5,  unit: '그룹', description: '5개 cuisine 그룹 경험 — 편식 X' },
  { code: 'cuisines_10', emoji: '🌍', label: '다국적 미식가',                axis: 'cuisines', tier: 2, threshold: 10, unit: '그룹', description: '10개 cuisine 그룹 섭렵' },
  { code: 'cuisines_13', emoji: '🌐', label: '지구 한 바퀴 완주',            axis: 'cuisines', tier: 3, threshold: 13, unit: '그룹', description: '13개 cuisine 그룹 모두 경험' },

  // I. 시간대
  { code: 'lunch_60',  emoji: '☀️', label: '점심반장', axis: 'time_lunch',  tier: 1, threshold: 60, unit: '%', description: '점심 사수 — 점심 commit 60%+' },
  { code: 'dinner_60', emoji: '🦉', label: '야근요정', axis: 'time_dinner', tier: 1, threshold: 60, unit: '%', description: '야근의 동반자 — 저녁 commit 60%+' },

  // J. cuisine 특화
  { code: 'cuisine_한식',          emoji: '🍚', label: '나는어쩔수없는한국인인가봐', axis: 'cuisine_한식',         tier: 1, threshold: 20, unit: 'commit', description: '한식 20번 — DNA 가 한식' },
  { code: 'cuisine_일식',          emoji: '🍣', label: '오겡끼데스까',               axis: 'cuisine_일식',         tier: 1, threshold: 20, unit: 'commit', description: '일식 20번 — 곤니찌와' },
  { code: 'cuisine_중식',          emoji: '🥟', label: '하오츠하오츠',               axis: 'cuisine_중식',         tier: 1, threshold: 20, unit: 'commit', description: '중식 20번 — 하오 츠하오 츠' },
  { code: 'cuisine_양식',          emoji: '🍝', label: '칼질좀하시나본데요',         axis: 'cuisine_양식',         tier: 1, threshold: 20, unit: 'commit', description: '양식 20번 — 포크나이프 마스터' },
  { code: 'cuisine_아시아',        emoji: '🍜', label: '아시아는하나지',             axis: 'cuisine_아시아',       tier: 1, threshold: 20, unit: 'commit', description: '아시아 20번 — 동남아 빠삭' },
  { code: 'cuisine_고기',          emoji: '🥩', label: '단백질이즈굿',               axis: 'cuisine_고기',         tier: 1, threshold: 20, unit: 'commit', description: '고기 20번 — 근육의 친구' },
  { code: 'cuisine_해산물',        emoji: '🦐', label: '인류는모두바다에서왔다',     axis: 'cuisine_해산물',       tier: 1, threshold: 20, unit: 'commit', description: '해산물 20번 — 바다 근본' },
  { code: 'cuisine_치킨',          emoji: '🍗', label: '오늘밤은치킨이닭',           axis: 'cuisine_치킨',         tier: 1, threshold: 20, unit: 'commit', description: '치킨 20번 — 한국인의 영혼' },
  { code: 'cuisine_피자',          emoji: '🍕', label: '피자러버',                   axis: 'cuisine_피자',         tier: 1, threshold: 20, unit: 'commit', description: '피자 20번 — 도우와 한 몸' },
  { code: 'cuisine_카페·디저트',   emoji: '☕', label: '내피에는카페인이흘러',       axis: 'cuisine_카페·디저트',  tier: 1, threshold: 20, unit: 'commit', description: '카페·디저트 20번 — 카페인 의존자' },
  { code: 'cuisine_술집',          emoji: '🍻', label: '오늘한잔어때',               axis: 'cuisine_술집',         tier: 1, threshold: 20, unit: 'commit', description: '술집 20번 — 회식 단골' },
  { code: 'cuisine_뷔페',          emoji: '🍽️', label: '뷔페마스터',                 axis: 'cuisine_뷔페',         tier: 1, threshold: 20, unit: 'commit', description: '뷔페 20번 — 본전 뽑기의 달인' },
  { code: 'cuisine_기타',          emoji: '🍱', label: '나는나의길을간다',           axis: 'cuisine_기타',         tier: 1, threshold: 20, unit: 'commit', description: '기타 20번 — 분류 거부' },
];

export const BADGE_BY_CODE = new Map(BADGES.map((b) => [b.code, b]));

// 도감 sectioning 용 axis 그룹
export const BADGE_SECTIONS = [
  { axis: 'commits',  label: '📈 활동량',  axes: ['commits'] },
  { axis: 'streak',   label: '🔥 꾸준함',  axes: ['streak'] },
  { axis: 'pioneer',  label: '🗺 개척',    axes: ['pioneer'] },
  { axis: 'cuisines', label: '🌐 다양성',  axes: ['cuisines'] },
  { axis: 'time',     label: '🕰 시간대',  axes: ['time_lunch', 'time_dinner'] },
  {
    axis: 'cuisine_spec',
    label: '🍱 cuisine 특화',
    axes: CUISINE_GROUP_LABELS.map((g) => `cuisine_${g}`),
  },
] as const;

// 같은 axis 안에서 최고 등급만 추리기 (compact chip 줄용)
export function reduceToTopTier(codes: string[]): BadgeMeta[] {
  const byAxis = new Map<string, BadgeMeta>();
  for (const c of codes) {
    const m = BADGE_BY_CODE.get(c);
    if (!m) continue;
    const cur = byAxis.get(m.axis);
    if (!cur || m.tier > cur.tier) byAxis.set(m.axis, m);
  }
  return Array.from(byAxis.values());
}
