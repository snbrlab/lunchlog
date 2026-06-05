// D80 보강: edit PR 의 필드 메타데이터 단일 출처.
// 이전엔 LogList / PRAdminList / OpenPullRequestModal / actions.ts 4곳에 흩어져있어
// 새 필드 추가 시 동기화 누락 위험. 한 descriptor 객체에서 다 derive.

import type { EditField, EditPayload } from '@/types/db';

export interface RestaurantSnapshot {
  name: string;
  price_level: 1 | 2 | 3;
  cuisine_types: string[];
  address: string;
  has_alcohol: boolean;
}

interface FieldDescriptor {
  label: string;
  // 현재 값 표시용 (사람이 읽기 좋게)
  currentDisplay: (r: RestaurantSnapshot) => string;
  // 사용자 raw 입력 → EditPayload['new'] (변경 없거나 무효면 null)
  parseEdit: (raw: string, r: RestaurantSnapshot) => EditPayload['new'] | null;
  // payload 의 current/new 값을 화면에 보여줄 때 포맷 (LogList / PRAdminList 카드)
  formatValue: (v: unknown) => string;
}

const FIELD_DESCRIPTORS: Record<EditField, FieldDescriptor> = {
  name: {
    label: '이름',
    currentDisplay: (r) => r.name,
    parseEdit: (raw, r) => {
      const v = raw.trim();
      if (!v || v === r.name) return null;
      return v;
    },
    formatValue: (v) => (typeof v === 'string' && v ? v : '(없음)'),
  },
  price_level: {
    label: '가격대',
    currentDisplay: (r) => '₩'.repeat(r.price_level),
    parseEdit: (raw, r) => {
      const n = Number(raw);
      if (![1, 2, 3].includes(n)) return null;
      if (n === r.price_level) return null;
      return n;
    },
    formatValue: (v) => (typeof v === 'number' ? '₩'.repeat(v) : '(없음)'),
  },
  cuisine_types: {
    label: 'cuisine',
    currentDisplay: (r) => r.cuisine_types.join(' / ') || '(없음)',
    parseEdit: (raw, r) => {
      const arr = raw
        .split(/[,\/]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (arr.length === 0) return null;
      const same =
        arr.length === r.cuisine_types.length &&
        arr.every((v, i) => v === r.cuisine_types[i]);
      if (same) return null;
      return arr;
    },
    formatValue: (v) => (Array.isArray(v) ? v.join(' / ') : '(없음)'),
  },
  address: {
    label: '주소',
    currentDisplay: (r) => r.address || '(없음)',
    parseEdit: (raw, r) => {
      const v = raw.trim();
      if (!v || v === r.address) return null;
      return v;
    },
    formatValue: (v) => (typeof v === 'string' && v ? v : '(없음)'),
  },
  has_alcohol: {
    label: '술 가능 여부',
    currentDisplay: (r) => (r.has_alcohol ? '가능' : '불가'),
    parseEdit: (raw, r) => {
      const b = raw === 'true';
      if (b === r.has_alcohol) return null;
      return b;
    },
    formatValue: (v) => (typeof v === 'boolean' ? (v ? '가능' : '불가') : '(없음)'),
  },
};

export const EDIT_FIELDS = Object.keys(FIELD_DESCRIPTORS) as EditField[];

export function fieldLabel(f: EditField): string {
  return FIELD_DESCRIPTORS[f].label;
}

export function fieldCurrentDisplay(f: EditField, r: RestaurantSnapshot): string {
  return FIELD_DESCRIPTORS[f].currentDisplay(r);
}

// payload 의 current 값 — 식당 스냅샷의 해당 필드를 그대로 가져옴
const CURRENT_OF: Record<EditField, (r: RestaurantSnapshot) => EditPayload['current']> = {
  name: (r) => r.name,
  price_level: (r) => r.price_level,
  cuisine_types: (r) => r.cuisine_types,
  address: (r) => r.address,
  has_alcohol: (r) => r.has_alcohol,
};

export function buildEditPayload(
  field: EditField,
  raw: string,
  r: RestaurantSnapshot,
): EditPayload | null {
  const newVal = FIELD_DESCRIPTORS[field].parseEdit(raw, r);
  if (newVal === null) return null;
  return { field, current: CURRENT_OF[field](r), new: newVal } as EditPayload;
}

// LogList / PRAdminList 의 before→after diff 셀 포맷
export function fmtFieldValue(field: EditField, v: unknown): string {
  return FIELD_DESCRIPTORS[field].formatValue(v);
}

// 입력값 초기화 — modal 에서 새 필드 선택했을 때 input 의 기본값
export function initialEditValue(field: EditField, r: RestaurantSnapshot): string {
  switch (field) {
    case 'name':
      return r.name;
    case 'price_level':
      return String(r.price_level);
    case 'cuisine_types':
      return r.cuisine_types.join(', ');
    case 'address':
      return r.address;
    case 'has_alcohol':
      return r.has_alcohol ? 'true' : 'false';
  }
}
