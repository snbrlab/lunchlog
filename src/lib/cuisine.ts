// cuisine 그룹 메타 — 코드 (한식/일식/...). 그 안의 항목은 cuisine_items 테이블에서 admin 관리.
// 항목은 { value: DB 에 저장될 값, label?: 화면 라벨 (없으면 value), emoji?: 핀/표시용 override }.
// 그룹은 emoji 필드 — 지도 핀 기본 이모지.

export interface CuisineGroupMeta {
  label: string;
  emoji: string;
  order: number;
  // D78: GitHub languages bar 스타일 차트용 색. 그룹별 명확히 구분되는 톤.
  color: string;
}

// 그룹 정의는 코드에 고정. admin 은 아이템만 추가/수정 가능 (D61).
// order 는 display 순서. 표시할 그룹 자체는 cuisine_items 의 group_label 과 매칭되는 것만.
export const CUISINE_GROUP_META: readonly CuisineGroupMeta[] = [
  { label: '한식', emoji: '🍚', order: 1, color: '#e76f51' }, // 따뜻한 빨강
  { label: '일식', emoji: '🍣', order: 2, color: '#f4a8a8' }, // 사쿠라 핑크
  { label: '중식', emoji: '🥢', order: 3, color: '#d62828' }, // 진한 빨강
  { label: '양식', emoji: '🍝', order: 4, color: '#e9c46a' }, // 파스타 노랑
  { label: '아시아', emoji: '🍜', order: 5, color: '#f4a261' }, // 오렌지
  { label: '고기', emoji: '🥩', order: 6, color: '#8b3a3a' }, // 짙은 와인
  { label: '해산물', emoji: '🐟', order: 7, color: '#4cb5ae' }, // 청록
  { label: '치킨', emoji: '🍗', order: 8, color: '#f6c54a' }, // 황금색
  { label: '피자', emoji: '🍕', order: 9, color: '#c44536' }, // 토마토
  { label: '버거', emoji: '🍔', order: 10, color: '#b48a3d' }, // 번 갈색
  { label: '카페/디저트', emoji: '☕', order: 11, color: '#6f4e37' }, // 커피
  { label: '술집', emoji: '🍺', order: 12, color: '#7d5ba6' }, // 보라
  { label: '뷔페', emoji: '🍽️', order: 13, color: '#52796f' }, // 짙은 녹색
  { label: '기타', emoji: '🍱', order: 99, color: '#94a3b8' }, // 회색
] as const;

// DB 의 cuisine_items 한 row 와 1:1
export interface CuisineItem {
  value: string;
  label: string | null;
  emoji: string | null;
  group_label: string;
  display_order: number;
}

// 그룹별로 묶어서 UI 에서 쓰기 좋게 구조화
export interface CuisineGroup {
  label: string;
  emoji: string;
  items: CuisineItem[];
}

// items 를 그룹 메타 순서대로 묶음. 항목 없는 그룹은 제외.
export function groupCuisineItems(items: readonly CuisineItem[]): CuisineGroup[] {
  return CUISINE_GROUP_META.map((meta) => ({
    label: meta.label,
    emoji: meta.emoji,
    items: items
      .filter((i) => i.group_label === meta.label)
      .slice()
      .sort((a, b) => a.display_order - b.display_order || a.value.localeCompare(b.value, 'ko')),
  })).filter((g) => g.items.length > 0);
}

// 항목의 라벨 — label 없으면 value 그대로
export function cuisineLabelFor(item: { value: string; label: string | null }): string {
  return item.label ?? item.value;
}

// value 가 속한 그룹 label 찾기
export function findCuisineGroup(value: string, items: readonly CuisineItem[]): string | undefined {
  return items.find((i) => i.value === value)?.group_label;
}

// value → 표시 emoji. 항목 emoji 우선, 없으면 그룹 emoji, 그것도 없으면 기본
export function emojiForCuisine(value: string, items: readonly CuisineItem[]): string {
  const item = items.find((i) => i.value === value);
  if (!item) return '🍱';
  if (item.emoji) return item.emoji;
  const meta = CUISINE_GROUP_META.find((g) => g.label === item.group_label);
  return meta?.emoji ?? '🍱';
}

// 모든 value 의 집합 (server action 검증용)
export function allCuisineValues(items: readonly CuisineItem[]): string[] {
  return items.map((i) => i.value);
}

// 호환용 — 기존엔 strict union 이었으나 DB 화로 단순 string. 런타임 검증으로 대체.
export type CuisineType = string;
