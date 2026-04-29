// cuisine_type 옵션의 단일 source of truth.
// 항목은 { value: DB 에 저장될 값, label?: 화면 표시 라벨 (없으면 value) }.
// 그룹은 emoji 필드 — 지도 핀에 표시.

interface CuisineItem {
  value: string;
  label?: string;
}

export const CUISINE_GROUPS = [
  {
    label: '한식',
    emoji: '🍚',
    items: [
      { value: '국밥' },
      { value: '찌개' },
      { value: '비빔밥' },
      { value: '김밥' },
      { value: '분식' },
      { value: '떡볶이' },
      { value: '칼국수' },
      { value: '냉면' },
      { value: '족발보쌈' },
      { value: '닭발' },
      { value: '샤브샤브' },
      { value: '만두' },
      { value: '전' },
      { value: '한정식' },
      { value: '한식', label: '기타' },
    ] as const,
  },
  {
    label: '일식',
    emoji: '🍣',
    items: [
      { value: '스시' },
      { value: '라멘' },
      { value: '돈카츠' },
      { value: '우동' },
      { value: '오마카세' },
      { value: '이자카야' },
      { value: '일식카레' },
      { value: '일식', label: '기타' },
    ] as const,
  },
  {
    label: '중식',
    emoji: '🥢',
    items: [
      { value: '짜장면/짬뽕' },
      { value: '마라탕' },
      { value: '딤섬' },
      { value: '훠궈' },
      { value: '중식', label: '기타' },
    ] as const,
  },
  {
    label: '양식',
    emoji: '🍝',
    items: [
      { value: '파스타' },
      { value: '스테이크' },
      { value: '햄버거' },
      { value: '샐러드' },
      { value: '브런치' },
      { value: '멕시칸' },
      { value: '양식', label: '기타' },
    ] as const,
  },
  {
    label: '아시아',
    emoji: '🍜',
    items: [
      { value: '쌀국수' },
      { value: '팟타이' },
      { value: '인도카레' },
      { value: '분짜' },
    ] as const,
  },
  {
    label: '고기',
    emoji: '🥩',
    items: [
      { value: '삼겹살' },
      { value: '소고기' },
      { value: '육회' },
      { value: '갈비' },
      { value: '양고기' },
      { value: '곱창' },
      { value: '장어' },
      { value: '닭갈비' },
    ] as const,
  },
  {
    label: '해산물',
    emoji: '🐟',
    items: [
      { value: '회' },
      { value: '조개구이' },
      { value: '매운탕' },
      { value: '해물찜' },
    ] as const,
  },
  {
    label: '치킨',
    emoji: '🍗',
    items: [{ value: '치킨' }] as const,
  },
  {
    label: '피자',
    emoji: '🍕',
    items: [{ value: '피자' }] as const,
  },
  {
    label: '카페/디저트',
    emoji: '☕',
    items: [
      { value: '커피' },
      { value: '베이커리' },
      { value: '디저트' },
      { value: '아이스크림' },
      { value: '카페', label: '기타' },
    ] as const,
  },
  {
    label: '술집',
    emoji: '🍺',
    items: [{ value: '술집' }] as const,
  },
  {
    label: '뷔페',
    emoji: '🍽️',
    items: [{ value: '뷔페' }] as const,
  },
  {
    label: '기타',
    emoji: '🍱',
    items: [{ value: '기타' }] as const,
  },
] as const;

type GroupItems = (typeof CUISINE_GROUPS)[number]['items'][number];
export type CuisineType = GroupItems['value'];

export const ALL_CUISINES: CuisineType[] = CUISINE_GROUPS.flatMap((g) =>
  g.items.map((i) => i.value),
) as CuisineType[];

// 항목의 라벨 (label 없으면 value 그대로)
export function cuisineLabelFor(item: CuisineItem): string {
  return item.label ?? item.value;
}

export function findCuisineGroup(c: CuisineType): string | undefined {
  return CUISINE_GROUPS.find((g) =>
    (g.items as readonly CuisineItem[]).some((i) => i.value === c),
  )?.label;
}

// cuisine_type 값 → 해당 그룹의 emoji
export function emojiForCuisine(c: CuisineType): string {
  for (const group of CUISINE_GROUPS) {
    if ((group.items as readonly CuisineItem[]).some((i) => i.value === c)) {
      return group.emoji;
    }
  }
  return '🍱';
}
