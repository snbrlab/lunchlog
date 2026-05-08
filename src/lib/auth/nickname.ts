// D53: 닉네임 중복 검사 (case-insensitive, trimmed).
// signup / onboarding / profile edit / admin create 에서 공통 사용.

import type { SupabaseClient } from '@supabase/supabase-js';

export const NICKNAME_MAX = 30;

export type NicknameValidation =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

export function validateNicknameShape(name: string): NicknameValidation {
  const normalized = name.trim();
  if (!normalized) return { ok: false, message: '닉네임을 입력해주세요' };
  if (normalized.length > NICKNAME_MAX) {
    return { ok: false, message: `닉네임은 ${NICKNAME_MAX}자 이내로 입력해주세요` };
  }
  return { ok: true, normalized };
}

// excludeUserId: 본인 닉네임 변경 시 자기 행은 제외.
// supabase: service-role 또는 일반 client. 둘 다 lower(name) 비교 가능 (RLS 가 select 를 막지 않는 한).
export async function isNicknameTaken(
  supabase: SupabaseClient,
  name: string,
  excludeUserId?: string,
): Promise<boolean> {
  const target = name.trim().toLowerCase();
  // PostgREST 는 lower() 컬럼 비교가 불가 → 모든 후보를 가져와서 lower 비교는 비효율.
  // 일단 ilike 로 (대소문자 무시) 정확 일치 검색 — 닉네임은 짧고 빈도 낮으니 OK.
  let q = supabase.from('users').select('id, name').ilike('name', target);
  if (excludeUserId) q = q.neq('id', excludeUserId);
  const { data } = await q;
  if (!data) return false;
  // ilike 는 와일드카드 없을 땐 정확 일치지만, trim 비교를 위해 한 번 더 검증
  return data.some((row) => row.name.trim().toLowerCase() === target);
}
