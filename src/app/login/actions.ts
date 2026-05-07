'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SignInWithPasswordResult =
  | { ok: false; reason: 'invalid' | 'domain' | 'wrong_credentials' | 'pending_approval' | 'unknown'; message: string };
// ok: true 시엔 redirect 가 throw 됨.

export async function signInWithPassword(formData: FormData): Promise<SignInWithPasswordResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !email.includes('@') || !password) {
    return { ok: false, reason: 'invalid', message: '이메일과 비밀번호를 입력해주세요' };
  }
  // 도메인 체크는 /signup 에서만. 로그인은 admin 이 직접 만든 외부 이메일 (D51) 도 통과해야 함.
  // 가입 안 된 이메일이면 Supabase 가 알아서 wrong_credentials 처리.

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    // email_not_confirmed = 가입 신청만 했고 admin 승인 전
    if (error.code === 'email_not_confirmed' || msg.includes('not confirmed')) {
      return {
        ok: false,
        reason: 'pending_approval',
        message: '관리자 승인 대기 중인 계정이에요. 승인되면 로그인할 수 있어요',
      };
    }
    if (error.status === 400 || msg.includes('invalid')) {
      return {
        ok: false,
        reason: 'wrong_credentials',
        message: '이메일 또는 비밀번호가 맞지 않거나, 아직 가입 신청을 안 하셨어요',
      };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }

  redirect('/map');
}
