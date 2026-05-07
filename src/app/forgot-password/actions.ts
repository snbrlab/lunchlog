'use server';

import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/email-domain';

export type RequestPasswordResetResult =
  | { ok: true; email: string }
  | {
      ok: false;
      reason: 'invalid' | 'domain' | 'rate_limited' | 'unknown';
      message: string;
    };

// 사용자가 비번 잊었을 때 self-service reset (D48).
// Supabase 가 reset 링크 메일 발송 → 사용자 클릭 시 /auth/callback?redirect=/reset-password 로 들어옴
// → callback 이 세션 만들고 /reset-password 로 redirect → 새 비번 입력
export async function requestPasswordReset(
  formData: FormData,
): Promise<RequestPasswordResetResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해주세요' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니에요' };
  }

  // origin 구성 — vercel/dev 어디든 동작하게 헤더에서 추출
  const h = await headers();
  const host = h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;
  const redirectTo = `${origin}/auth/callback?redirect=/reset-password`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    if (error.status === 429) {
      return {
        ok: false,
        reason: 'rate_limited',
        message: '메일 발송 한도 초과. 잠시 뒤 다시 시도해주세요',
      };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }
  return { ok: true, email };
}
