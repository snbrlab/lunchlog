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
  kakao_place_url: string | null;
  categories: string[]; // 'lunch' / 'dinner'
}

const CATEGORY_LABELS: Record<string, string> = { lunch: '☀ 점심', dinner: '🌙 저녁' };
function fmtCategories(arr: string[]): string {
  return arr.map((c) => CATEGORY_LABELS[c] ?? c).join(' / ');
}

// 카카오 도메인 화이트리스트 — restaurants/actions.ts 의 isAllowedKakaoUrl 과 동일 규칙
function isAllowedKakaoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'place.map.kakao.com' || u.hostname.endsWith('.kakao.com');
  } catch {
    return false;
  }
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
  kakao_place_url: {
    label: '카카오맵 링크',
    currentDisplay: (r) => r.kakao_place_url ?? '(없음)',
    parseEdit: (raw, r) => {
      const v = raw.trim();
      if (!v) return null;
      if (!isAllowedKakaoUrl(v)) return null; // 카카오 도메인 외 거부 (보안)
      if (v === r.kakao_place_url) return null;
      return v;
    },
    formatValue: (v) => (typeof v === 'string' && v ? v : '(없음)'),
  },
  categories: {
    label: '점심/저녁',
    currentDisplay: (r) => fmtCategories(r.categories) || '(없음)',
    parseEdit: (raw, r) => {
      // raw 는 콤마 구분 ('lunch', 'dinner', 'lunch,dinner')
      const arr = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s): s is 'lunch' | 'dinner' => s === 'lunch' || s === 'dinner');
      if (arr.length === 0) return null; // 최소 하나
      // 같은지 비교 (순서 무관)
      const setNew = new Set(arr);
      const setCur = new Set(r.categories);
      if (setNew.size === setCur.size && [...setNew].every((v) => setCur.has(v))) return null;
      // 정규화 순서 (lunch 먼저)
      return (['lunch', 'dinner'] as const).filter((c) => setNew.has(c));
    },
    formatValue: (v) => (Array.isArray(v) ? fmtCategories(v) : '(없음)'),
  },
};

export const EDIT_FIELDS = Object.keys(FIELD_DESCRIPTORS) as EditField[];

// 서버측 재검증 — PR insert 는 RLS 만 통과하면 임의 edit_payload 를 저장할 수 있으므로
// (client buildEditPayload 를 안 거침) apply 직전에 저장된 new 값의 타입/허용범위를 다시 확인.
// 특히 kakao_place_url 의 javascript: 스킴 stored-XSS 차단.
export function validateEditValue(field: EditField, v: unknown): boolean {
  switch (field) {
    case 'name':
    case 'address':
      return typeof v === 'string' && v.trim().length > 0;
    case 'price_level':
      return v === 1 || v === 2 || v === 3;
    case 'has_alcohol':
      return typeof v === 'boolean';
    case 'cuisine_types':
      return Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string');
    case 'categories':
      return (
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((s) => s === 'lunch' || s === 'dinner')
      );
    case 'kakao_place_url':
      return typeof v === 'string' && isAllowedKakaoUrl(v);
    default:
      return false;
  }
}

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
  kakao_place_url: (r) => r.kakao_place_url,
  categories: (r) => r.categories,
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
const INITIAL_EDIT_VALUE: Record<EditField, (r: RestaurantSnapshot) => string> = {
  name: (r) => r.name,
  price_level: (r) => String(r.price_level),
  cuisine_types: (r) => r.cuisine_types.join(', '),
  address: (r) => r.address,
  has_alcohol: (r) => (r.has_alcohol ? 'true' : 'false'),
  kakao_place_url: (r) => r.kakao_place_url ?? '',
  categories: (r) => r.categories.join(','),
};

export function initialEditValue(field: EditField, r: RestaurantSnapshot): string {
  return INITIAL_EDIT_VALUE[field](r);
}
