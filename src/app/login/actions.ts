'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail, suggestNameFromEmail } from '@/lib/auth/email-domain';
import { avatarColorFor } from '@/lib/avatar-color';

export type RequestOtpResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid' | 'domain' | 'rate_limited' | 'unknown'; message: string };

export type VerifyOtpResult =
  | { ok: false; reason: 'invalid' | 'wrong_code' | 'unknown'; message: string };
// ok: true 시엔 redirect 가 throw 됨.

export type SignInWithPasswordResult =
  | { ok: false; reason: 'invalid' | 'domain' | 'wrong_credentials' | 'unknown'; message: string };

// 메일에 6자리 OTP 코드 발송. 회사 Outlook Safe Links 가 url 미리 클릭하는 문제 회피용.
// (매직링크 url 대신 코드만 메일에 포함되려면 Supabase Email Template 의 {{ .ConfirmationURL }} 부분을
//  지우고 {{ .Token }} 만 남겨야 함.)
export async function requestOtp(formData: FormData): Promise<RequestOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해줘' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니야' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    if (error.status === 429) {
      return {
        ok: false,
        reason: 'rate_limited',
        message: '메일 발송 한도 초과. 한 시간쯤 뒤에 다시 시도해줘',
      };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }
  return { ok: true, email };
}

// 사용자가 메일에서 받은 6자리 코드 입력 → 검증 + users 행 보장 + 적절한 페이지로 redirect.
export async function verifyOtp(formData: FormData): Promise<VerifyOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  if (!email || !/^\d{6}$/.test(token)) {
    return { ok: false, reason: 'invalid', message: '이메일과 6자리 숫자 코드를 입력해줘' };
  }

  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (verifyError) {
    return {
      ok: false,
      reason: 'wrong_code',
      message: '코드가 틀렸거나 만료됐어. 메일 다시 확인 또는 재전송',
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, reason: 'unknown', message: '인증 후 사용자 정보 없음' };
  }
  // 도메인 재검증 (Supabase 측에서도 막히긴 하지만 이중 안전)
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return { ok: false, reason: 'unknown', message: '허용 도메인이 아니야' };
  }

  // users 프로필 행 보장
  const { data: existing } = await supabase
    .from('users')
    .select('office_id, building_id, password_set')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const name = suggestNameFromEmail(user.email);
    const { error: insertError } = await supabase.from('users').insert({
      id: user.id,
      email: user.email,
      name,
      avatar_color: avatarColorFor(name + user.id),
    });
    if (insertError) {
      return { ok: false, reason: 'unknown', message: insertError.message };
    }
    redirect('/onboarding');
  }

  if (!existing.office_id || !existing.building_id) redirect('/onboarding');
  if (!existing.password_set) redirect('/set-password');
  redirect('/map');
}

export async function signInWithPassword(formData: FormData): Promise<SignInWithPasswordResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !email.includes('@') || !password) {
    return { ok: false, reason: 'invalid', message: '이메일과 비밀번호를 입력해줘' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니야' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.status === 400 || error.message.toLowerCase().includes('invalid')) {
      return {
        ok: false,
        reason: 'wrong_credentials',
        message: '이메일 또는 비밀번호가 맞지 않거나, 아직 비번을 설정하지 않았어',
      };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }

  redirect('/map');
}
