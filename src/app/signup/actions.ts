'use server';

import { isAllowedEmail } from '@/lib/auth/email-domain';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export type RequestSignupResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'domain' | 'duplicate' | 'unknown'; message: string };

const MIN_PASSWORD_LENGTH = 8;

export async function requestSignup(formData: FormData): Promise<RequestSignupResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');

  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해줘' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니야' };
  }
  if (!name || name.length > 30) {
    return { ok: false, reason: 'invalid', message: '이름을 입력해줘 (1~30자)' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: 'invalid',
      message: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 해`,
    };
  }
  if (password !== passwordConfirm) {
    return { ok: false, reason: 'invalid', message: '비밀번호 확인이 일치하지 않아' };
  }

  const admin = getSupabaseAdminClient();

  // 이미 pending/approved 상태인 가입 요청이 있는지 확인
  // (denied 는 재신청 허용)
  const { data: existing } = await admin
    .from('signup_requests')
    .select('id, status')
    .eq('email', email)
    .in('status', ['pending', 'approved'])
    .maybeSingle();

  if (existing) {
    const msg =
      existing.status === 'pending'
        ? '이미 가입 신청 중이야. 관리자 승인을 기다려줘'
        : '이미 가입돼 있어. 로그인 페이지에서 비밀번호로 로그인해줘';
    return { ok: false, reason: 'duplicate', message: msg };
  }

  // auth.users 에 미승인 (email_confirm: false) 상태로 생성
  // — Supabase 가 비번 hashing 처리. 우리 DB 엔 비번 평문/해시 안 저장.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { name },
  });

  if (createError || !created?.user) {
    // "User already registered" 등은 이메일이 auth.users 에 이미 있는 경우 (위 select 가 못 잡은 케이스)
    const msg = createError?.message ?? '가입 요청 처리 실패';
    if (msg.toLowerCase().includes('already')) {
      return {
        ok: false,
        reason: 'duplicate',
        message: '이미 가입 신청됐거나 가입된 이메일이야',
      };
    }
    return { ok: false, reason: 'unknown', message: msg };
  }

  const { error: insertError } = await admin.from('signup_requests').insert({
    email,
    name,
    auth_user_id: created.user.id,
    status: 'pending',
  });

  if (insertError) {
    // signup_requests insert 실패 → auth user 도 롤백
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, reason: 'unknown', message: insertError.message };
  }

  return { ok: true };
}
