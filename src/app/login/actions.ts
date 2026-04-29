'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/email-domain';

export type RequestMagicLinkResult =
  | { ok: true; email: string }
  | { ok: false; reason: 'invalid' | 'domain' | 'rate_limited' | 'unknown'; message: string };

export type SignInWithPasswordResult =
  | { ok: false; reason: 'invalid' | 'domain' | 'wrong_credentials' | 'unknown'; message: string };
// ok: true 시엔 redirect 가 throw 되므로 반환 타입에 포함 안 함.

export async function requestMagicLink(formData: FormData): Promise<RequestMagicLinkResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해줘' };
  }

  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      reason: 'domain',
      message: '허용된 회사 이메일 도메인이 아니야',
    };
  }

  const hdrs = await headers();
  const host = hdrs.get('host') ?? 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const redirectTo = `${proto}://${host}/auth/callback`;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: true,
    },
  });

  if (error) {
    if (error.status === 429) {
      return {
        ok: false,
        reason: 'rate_limited',
        message:
          '메일 발송 한도 초과 (Supabase 무료 SMTP 는 이메일당 시간당 3통). 한 시간쯤 뒤에 다시 시도하거나 관리자에게 Custom SMTP 설정 요청.',
      };
    }
    return { ok: false, reason: 'unknown', message: error.message };
  }

  return { ok: true, email };
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

