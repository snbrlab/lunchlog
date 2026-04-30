'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMOJI_POOL } from '@/lib/avatar-emoji';

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

  if (password.length < MIN) return { ok: false, message: `최소 ${MIN}자 이상이어야 해` };
  if (password.length > MAX) return { ok: false, message: `${MAX}자 이내로 줄여줘` };
  if (password !== confirm) return { ok: false, message: '비번 확인이 일치하지 않아' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어. 다시 로그인해줘' };

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
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdateProfileResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, message: '표시 이름을 입력해줘' };
  if (name.length > 40) return { ok: false, message: '이름은 40자 이내' };
  if (!input.officeId) return { ok: false, message: '사무실을 선택해줘' };
  if (!input.buildingId) return { ok: false, message: '건물을 선택해줘' };
  if (!(EMOJI_POOL as readonly string[]).includes(input.avatarEmoji)) {
    return { ok: false, message: '잘못된 이모지' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션 만료. 다시 로그인' };

  // 건물이 선택한 사무실 소속인지 검증 (클라 변조 방지)
  const { data: building } = await supabase
    .from('office_buildings')
    .select('office_id')
    .eq('id', input.buildingId)
    .maybeSingle();
  if (!building || building.office_id !== input.officeId) {
    return { ok: false, message: '잘못된 건물 선택' };
  }

  const { error } = await supabase
    .from('users')
    .update({
      name,
      department: input.department?.trim() || null,
      office_id: input.officeId,
      building_id: input.buildingId,
      avatar_emoji: input.avatarEmoji,
    })
    .eq('id', user.id);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
