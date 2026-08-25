// 만세력 계산 — lunar-typescript 로 생년월일(+시각, 양/음력) → 사주 오행·세기·계절·부족·십성축.
// 메뉴 결정엔 오행/세기/계절/seed 를 쓰고, 십성축은 "성격 한 줄" 재미 요소로만 쓴다.
import { Solar, Lunar } from 'lunar-typescript';
import type { Element, Strength } from './menus';
import { strengthOf } from './menus';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Axis = 'self' | 'express' | 'wealth' | 'order' | 'insight';

export interface SajuInput {
  year: number;
  month: number;
  day: number;
  hour?: number; // 0~23, 없으면 시주 생략
  calendar?: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}

export interface Pillar {
  label: string; // 연/월/일/시
  gan: string; // 천간 한자 (甲乙…)
  ganKo: string; // 갑을…
  ganElement: Element;
  zhi: string; // 지지 한자 (子丑…)
  zhiKo: string;
  zhiElement: Element;
}

export interface SajuResult {
  palja: string; // "甲戌 丁卯 丙午 乙未"
  dayGan: string; // 일간 한자 (丙)
  dayGanKo: string; // 병
  dayElement: Element;
  dayYinYang: 'yang' | 'yin';
  strength: Strength; // 일간 오행 개수 → 약/중/강
  counts: Record<Element, number>;
  lackElement: Element; // 가장 적은 오행 (곁들이 처방)
  lackIsNone: boolean; // 오행이 모두 있으면 true (부족 없음)
  season: Season;
  dominantAxis: Axis; // 최다 십성축 (성격)
  dominantAxes: Axis[]; // 상위 2개 (두드러지는 성향)
  pillars: Pillar[]; // 연월일시 (표시용, 연→시 순)
  hasBirthTime: boolean;
  timeZhi: string; // 시지 한자 (午). 시각 없으면 ''
  timeZhiKo: string; // 오. 시각 없으면 ''
  yinYangTilt: 'yang' | 'yin' | 'balanced'; // 팔자 전체 음양 기울기
  seed: number; // 메뉴 후보 선택용 (결정론)
}

// 한자 천간/지지 → 한글
const GAN_KO: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const ZHI_KO: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

// 오행 한자 → 우리 Element (라이브러리는 木火土金水 그대로 반환)
const WX: Record<string, Element> = { 木: '木', 火: '火', 土: '土', 金: '金', 水: '水' };
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']); // 나머지는 음간
const YANG_ZHI = new Set(['子', '寅', '辰', '午', '申', '戌']); // 나머지는 음지

// 십성(간체) → 5축
const SHISHEN_AXIS: Record<string, Axis> = {
  比肩: 'self', 劫财: 'self',
  食神: 'express', 伤官: 'express',
  偏财: 'wealth', 正财: 'wealth',
  七杀: 'order', 偏官: 'order', 正官: 'order',
  偏印: 'insight', 正印: 'insight',
};

// 월지 → 계절 (寅卯辰 봄 / 巳午未 여름 / 申酉戌 가을 / 亥子丑 겨울)
const SEASON_BY_ZHI: Record<string, Season> = {
  寅: 'spring', 卯: 'spring', 辰: 'spring',
  巳: 'summer', 午: 'summer', 未: 'summer',
  申: 'autumn', 酉: 'autumn', 戌: 'autumn',
  亥: 'winter', 子: 'winter', 丑: 'winter',
};
const SEASON_INDEX: Record<Season, number> = { spring: 0, summer: 1, autumn: 2, winter: 3 };

export function computeSaju(input: SajuInput): SajuResult {
  const hasBirthTime = typeof input.hour === 'number';
  const h = input.hour ?? 12; // 시각 없으면 정오로 계산하되, 시주 오행/십성은 카운트에서 제외
  const mi = 30;

  let solar: Solar;
  if (input.calendar === 'lunar') {
    const lunar = Lunar.fromYmdHms(
      input.year,
      (input.isLeapMonth ? -1 : 1) * input.month,
      input.day,
      h,
      mi,
      0,
    );
    solar = lunar.getSolar();
  } else {
    solar = Solar.fromYmdHms(input.year, input.month, input.day, h, mi, 0);
  }
  const ec = solar.getLunar().getEightChar();

  // 오행 카운트 — 년/월/일 은 항상, 시는 생시 있을 때만 (각 주 = 천간+지지 = 2글자)
  const wxStrings = [ec.getYearWuXing(), ec.getMonthWuXing(), ec.getDayWuXing()];
  if (hasBirthTime) wxStrings.push(ec.getTimeWuXing());
  const counts: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const s of wxStrings) for (const ch of Array.from(s)) {
    const el = WX[ch];
    if (el) counts[el]++;
  }

  const dayGan = ec.getDayGan();
  const dayElement = WX[Array.from(ec.getDayWuXing())[0]!]!; // 일간 오행
  const dayYinYang = YANG_GAN.has(dayGan) ? 'yang' : 'yin';
  const strength = strengthOf(counts[dayElement]);

  // 부족 오행 = 카운트 최소 (동률이면 목화토금수 순 첫번째)
  const order: Element[] = ['木', '火', '土', '金', '水'];
  const lackElement = order.reduce((a, b) => (counts[b] < counts[a] ? b : a), order[0]!);

  // 계절 = 월지
  const season = SEASON_BY_ZHI[ec.getMonthZhi()] ?? 'spring';

  // 최다 십성축 (성격) — 년/월/시 천간 십성 + 지지 지장간 십성 집계
  const axisCount: Record<Axis, number> = { self: 0, express: 0, wealth: 0, order: 0, insight: 0 };
  const shishen: string[] = [
    ec.getYearShiShenGan(),
    ec.getMonthShiShenGan(),
    ...(hasBirthTime ? [ec.getTimeShiShenGan()] : []),
    ...ec.getYearShiShenZhi(),
    ...ec.getMonthShiShenZhi(),
    ...ec.getDayShiShenZhi(),
    ...(hasBirthTime ? ec.getTimeShiShenZhi() : []),
  ];
  for (const s of shishen) {
    const ax = SHISHEN_AXIS[s];
    if (ax) axisCount[ax]++;
  }
  const axes: Axis[] = ['self', 'express', 'wealth', 'order', 'insight'];
  const dominantAxis = axes.reduce((a, b) => (axisCount[b] > axisCount[a] ? b : a), axes[0]!);
  const dominantAxes = [...axes].sort((a, b) => axisCount[b] - axisCount[a]).slice(0, 2);

  // 팔자 4주 (연월일시) — 각 주 = 천간+지지, 오행은 getXWuXing() 2글자
  const [yg, zg] = Array.from(ec.getYearWuXing()) as [string, string];
  const [mg, mz] = Array.from(ec.getMonthWuXing()) as [string, string];
  const [dg, dz] = Array.from(ec.getDayWuXing()) as [string, string];
  const [tg, tz] = Array.from(ec.getTimeWuXing()) as [string, string];
  const pillars: Pillar[] = [
    mkPillar('연', ec.getYearGan(), ec.getYearZhi(), yg, zg),
    mkPillar('월', ec.getMonthGan(), ec.getMonthZhi(), mg, mz),
    mkPillar('일', ec.getDayGan(), ec.getDayZhi(), dg, dz),
    mkPillar('시', ec.getTimeGan(), ec.getTimeZhi(), tg, tz),
  ];

  const lackIsNone = order.every((e) => counts[e] > 0);

  // 음양 기울기 — 팔자 8글자(천간+지지) 중 양이 많으면 yang, 적으면 yin
  const gans = [ec.getYearGan(), ec.getMonthGan(), ec.getDayGan(), ...(hasBirthTime ? [ec.getTimeGan()] : [])];
  const zhis = [ec.getYearZhi(), ec.getMonthZhi(), ec.getDayZhi(), ...(hasBirthTime ? [ec.getTimeZhi()] : [])];
  const yangN = gans.filter((g) => YANG_GAN.has(g)).length + zhis.filter((z) => YANG_ZHI.has(z)).length;
  const total = gans.length + zhis.length;
  const yinYangTilt: 'yang' | 'yin' | 'balanced' =
    yangN * 2 > total ? 'yang' : yangN * 2 < total ? 'yin' : 'balanced';

  const timeZhi = hasBirthTime ? ec.getTimeZhi() : '';

  // seed = 일주 + 계절 + 시 조합 (같은 오행·세기여도 사람마다 다른 메뉴 뽑히게)
  const seed =
    ec.getDayGanIndex() * 12 +
    ec.getDayZhiIndex() +
    SEASON_INDEX[season] * 13 +
    (hasBirthTime ? h * 7 : 0);

  return {
    palja: [ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime()].join(' '),
    dayGan,
    dayGanKo: GAN_KO[dayGan] ?? dayGan,
    dayElement,
    dayYinYang,
    strength,
    counts,
    lackElement,
    lackIsNone,
    season,
    dominantAxis,
    dominantAxes,
    pillars,
    hasBirthTime,
    timeZhi,
    timeZhiKo: ZHI_KO[timeZhi] ?? '',
    yinYangTilt,
    seed,
  };
}

function mkPillar(label: string, gan: string, zhi: string, ganEl: string, zhiEl: string): Pillar {
  return {
    label,
    gan,
    ganKo: GAN_KO[gan] ?? gan,
    ganElement: (WX[ganEl] ?? '土') as Element,
    zhi,
    zhiKo: ZHI_KO[zhi] ?? zhi,
    zhiElement: (WX[zhiEl] ?? '土') as Element,
  };
}
