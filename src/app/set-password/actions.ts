'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; message: string };

const MIN = 8;
const MAX = 72; // bcrypt 한계

export async function setPassword(formData: FormData): Promise<SetPasswordResult> {
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

  const { error: profileError } = await supabase
    .from('users')
    .update({ password_set: true })
    .eq('id', user.id);
  if (profileError) return { ok: false, message: profileError.message };

  redirect('/map');
}
