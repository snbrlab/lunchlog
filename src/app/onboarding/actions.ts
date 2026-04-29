'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { avatarColorFor } from '@/lib/avatar-color';
import { EMOJI_POOL } from '@/lib/avatar-emoji';

export type CompleteOnboardingResult =
  | { ok: true }
  | { ok: false; message: string };

export async function completeOnboarding(formData: FormData): Promise<CompleteOnboardingResult> {
  const name = String(formData.get('name') ?? '').trim();
  const department = String(formData.get('department') ?? '').trim() || null;
  const officeId = String(formData.get('office_id') ?? '').trim();
  const buildingId = String(formData.get('building_id') ?? '').trim();
  const avatarEmoji = String(formData.get('avatar_emoji') ?? '').trim();

  if (!name) return { ok: false, message: '표시 이름을 입력해줘' };
  if (!officeId) return { ok: false, message: '사무실을 선택해줘' };
  if (!buildingId) return { ok: false, message: '건물을 선택해줘' };
  if (!avatarEmoji || !(EMOJI_POOL as readonly string[]).includes(avatarEmoji)) {
    return { ok: false, message: '잘못된 이모지 선택' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어. 다시 로그인해줘' };

  // 건물이 선택한 사무실 소속인지 검증 (클라이언트 변조 방지)
  const { data: building } = await supabase
    .from('office_buildings')
    .select('id, office_id')
    .eq('id', buildingId)
    .maybeSingle();

  if (!building || building.office_id !== officeId) {
    return { ok: false, message: '잘못된 건물 선택' };
  }

  const { error } = await supabase
    .from('users')
    .update({
      name,
      department,
      office_id: officeId,
      building_id: buildingId,
      avatar_color: avatarColorFor(name + user.id),
      avatar_emoji: avatarEmoji,
    })
    .eq('id', user.id);

  if (error) return { ok: false, message: error.message };

  redirect('/map');
}
