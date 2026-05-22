'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMOJI_POOL } from '@/lib/avatar-emoji';
import { isNicknameTaken, validateNicknameShape } from '@/lib/auth/nickname';
import { BADGE_BY_CODE } from '@/lib/badges';
import { invalidateReviewsLogCache } from '@/lib/cache/reviews-log';

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; message: string };

export type UpdateProfileResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN = 8;
const MAX = 72;

export async function changePassword(formData: FormData): Promise<ChangePasswordResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < MIN) return { ok: false, message: `최소 ${MIN}자 이상이어야 해요` };
  if (password.length > MAX) return { ok: false, message: `${MAX}자 이내로 줄여주세요` };
  if (password !== confirm) return { ok: false, message: '비번 확인이 일치하지 않아요' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어요. 다시 로그인해주세요' };

  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) return { ok: false, message: authError.message };

  // admin 임시비번 reset 후 첫 비번 설정 흐름도 여기서 커버 (password_set 복원)
  const { error: profileError } = await supabase
    .from('users')
    .update({ password_set: true })
    .eq('id', user.id);
  if (profileError) return { ok: false, message: profileError.message };

  return { ok: true };
}

interface UpdateProfileInput {
  name: string;
  department: string | null;
  officeId: string;
  buildingId: string;
  avatarEmoji: string;
  // D68: 사용자 지정 좌표 (공유 오피스 등). 둘 다 null 이면 비활성 → 등록 건물 좌표 사용.
  customLat: number | null;
  customLng: number | null;
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const nameCheck = validateNicknameShape(input.name);
  if (!nameCheck.ok) return { ok: false, message: nameCheck.message };
  const name = nameCheck.normalized;
  if (!input.officeId) return { ok: false, message: '사무실을 선택해주세요' };
  if (!input.buildingId) return { ok: false, message: '건물을 선택해주세요' };
  if (!(EMOJI_POOL as readonly string[]).includes(input.avatarEmoji)) {
    return { ok: false, message: '잘못된 이모지예요' };
  }

  // D68: custom 좌표 — 둘 다 set 이거나 둘 다 null
  const hasCustom = input.customLat != null && input.customLng != null;
  const halfCustom = (input.customLat == null) !== (input.customLng == null);
  if (halfCustom) {
    return { ok: false, message: '사용자 지정 좌표는 위·경도 둘 다 필요해요' };
  }
  if (
    hasCustom &&
    (!Number.isFinite(input.customLat as number) ||
      !Number.isFinite(input.customLng as number) ||
      (input.customLat as number) < -90 ||
      (input.customLat as number) > 90 ||
      (input.customLng as number) < -180 ||
      (input.customLng as number) > 180)
  ) {
    return { ok: false, message: '좌표가 올바르지 않아요' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어요. 다시 로그인해주세요' };

  // D53: 닉네임 중복 체크 (본인 행은 제외)
  if (await isNicknameTaken(supabase, name, user.id)) {
    return { ok: false, message: '이미 사용 중인 닉네임이에요' };
  }

  // 건물이 선택한 사무실 소속인지 검증 (클라 변조 방지)
  const { data: building } = await supabase
    .from('office_buildings')
    .select('office_id')
    .eq('id', input.buildingId)
    .maybeSingle();
  if (!building || building.office_id !== input.officeId) {
    return { ok: false, message: '잘못된 건물 선택이에요' };
  }

  const { error } = await supabase
    .from('users')
    .update({
      name,
      department: input.department?.trim() || null,
      office_id: input.officeId,
      building_id: input.buildingId,
      avatar_emoji: input.avatarEmoji,
      custom_lat: hasCustom ? input.customLat : null,
      custom_lng: hasCustom ? input.customLng : null,
    })
    .eq('id', user.id);

  if (error) return { ok: false, message: error.message };
  // name / avatar_emoji / office_id 등이 /log author embed 에 들어가 있어서 무효화
  invalidateReviewsLogCache();
  return { ok: true };
}

// D70: /log 등에서 노출할 대표 뱃지 선택. null 이면 표시 안 함.
export type SetPrimaryBadgeResult = { ok: true } | { ok: false; message: string };

export async function setPrimaryBadge(
  code: string | null,
): Promise<SetPrimaryBadgeResult> {
  if (code !== null && !BADGE_BY_CODE.has(code)) {
    return { ok: false, message: '존재하지 않는 뱃지예요' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어요' };

  // 본인이 그 뱃지를 보유하고 있는지 검증
  if (code !== null) {
    const { data: owned } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', user.id)
      .eq('code', code)
      .maybeSingle();
    if (!owned) return { ok: false, message: '받지 않은 뱃지는 선택할 수 없어요' };
  }

  const { error } = await supabase
    .from('users')
    .update({ primary_badge_code: code })
    .eq('id', user.id);
  if (error) return { ok: false, message: error.message };
  // /log 캐시가 author.primary_badge_code 를 embed 하므로 무효화 필요
  invalidateReviewsLogCache();
  return { ok: true };
}
