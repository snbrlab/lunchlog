'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN = 8;
const MAX = 72;

// 비번 재설정 — /auth/callback 에서 세션 만들어진 후 호출됨.
// 사용자가 reset 메일 링크 통해 들어왔거나 (정상 흐름),
// 직접 url 진입했어도 인증된 상태면 동작 (보안 OK — 인증 필요).
export async function resetPassword(formData: FormData): Promise<ResetPasswordResult> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (password.length < MIN) return { ok: false, message: `${MIN}자 이상이어야 해요` };
  if (password.length > MAX) return { ok: false, message: `${MAX}자 이내로 줄여주세요` };
  if (password !== confirm) return { ok: false, message: '비밀번호 확인이 일치하지 않아요' };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '세션이 만료됐어요. 다시 reset 메일을 받아주세요' };

  const { error: authError } = await supabase.auth.updateUser({ password });
  if (authError) return { ok: false, message: authError.message };

  // password_set 가 false 였다면 다시 true 로 (admin 임시비번 reset 케이스 호환)
  const { error: profileError } = await supabase
    .from('users')
    .update({ password_set: true })
    .eq('id', user.id);
  if (profileError) return { ok: false, message: profileError.message };

  redirect('/map');
}
