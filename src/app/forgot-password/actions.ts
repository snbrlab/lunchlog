'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/email-domain';

export type RequestOtpResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: 'invalid' | 'domain' | 'rate_limited' | 'unknown';
      message: string;
    };

export type VerifyOtpResult = {
  ok: false;
  reason: 'invalid' | 'wrong_code' | 'unknown';
  message: string;
};
// 성공 시 redirect → /reset-password 로 이동 (throw)

// D48: OTP 기반 비번 재설정.
// resetPasswordForEmail (링크) 대신 signInWithOtp + verifyOtp 사용 — 회사 메일
// Outlook Safe Links 가 링크 미리 클릭해서 토큰 소진시키는 사고 방지 (D30 학습).
// 흐름: 이메일 입력 → 코드 메일 → 코드 입력 → 인증된 세션 → /reset-password 에서 새 비번 입력
export async function requestOtp(formData: FormData): Promise<RequestOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해주세요' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니에요' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // 가입 안 된 사용자는 reset 못 함 (가입 흐름과 분리)
    options: { shouldCreateUser: false },
  });

  if (error) {
    if (error.status === 429) {
      return {
        ok: false,
        reason: 'rate_limited',
        message: '메일 발송 한도 초과. 잠시 뒤 다시 시도해주세요',
      };
    }
    // user not found 등은 보안상 일반 메시지로
    return { ok: false, reason: 'unknown', message: error.message };
  }
  return { ok: true, email };
}

export async function verifyOtp(formData: FormData): Promise<VerifyOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  if (!email || !/^\d{6,10}$/.test(token)) {
    return { ok: false, reason: 'invalid', message: '이메일과 숫자 코드를 입력해주세요' };
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
      message: '코드가 틀렸거나 만료됐어요. 메일 다시 확인 또는 재전송',
    };
  }

  // 인증 성공 → 새 비번 입력 페이지로
  redirect('/reset-password');
}
