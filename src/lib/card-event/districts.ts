// scripts/import-card-event.mjs 의 DISTRICTS 와 값이 같아야 함 (import-card-event.mjs 가
// 이 값들을 직접 DB 에 적어넣으므로, 여기선 화면(탭) 순서/라벨 표시용으로만 씀).

export interface CardEventDistrict {
  code: string;
  label: string;
}

export const CARD_EVENT_DISTRICTS: CardEventDistrict[] = [
  { code: 'gangbuk', label: '강북구' },
  { code: 'jungnang', label: '중랑구' },
  { code: 'jung', label: '중구' },
  { code: 'seongbuk', label: '성북구' },
  { code: 'seocho', label: '서초구' },
  { code: 'dongjak', label: '동작구' },
  { code: 'dongdaemun', label: '동대문구' },
  { code: 'gwangjin', label: '광진구' },
  { code: 'gwanak', label: '관악구' },
  { code: 'gangseo', label: '강서구' },
];

export const CARD_EVENT_ID = '2026080030';
