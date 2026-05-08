'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail, suggestNameFromEmail } from '@/lib/auth/email-domain';
import { avatarColorFor } from '@/lib/avatar-color';
import { isNicknameTaken } from '@/lib/auth/nickname';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

// D47: OTP 가입 흐름 부활 — Brevo SMTP 로 메일 도달 검증 끝나서 admin 승인 (D38) 대체.
// 1) /signup: 이메일 + 닉네임 → requestOtp → Brevo 가 6~8자리 코드 발송
// 2) /signup: 코드 입력 → verifyOtp → auto-confirm + users 행 생성 → /onboarding
// 3) /onboarding: 사무실/건물/이모지 (닉네임 prefill) → /set-password → /map

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
// ok: true 시엔 redirect 가 throw 됨.

const NAME_MAX = 30;

export async function requestOtp(formData: FormData): Promise<RequestOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('name') ?? '').trim();

  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'invalid', message: '이메일을 정확히 입력해주세요' };
  }
  if (!isAllowedEmail(email)) {
    return { ok: false, reason: 'domain', message: '허용된 회사 이메일 도메인이 아니에요' };
  }
  if (!name || name.length > NAME_MAX) {
    return {
      ok: false,
      reason: 'invalid',
      message: `닉네임을 입력해주세요 (1~${NAME_MAX}자)`,
    };
  }

  // D53: 닉네임 중복 체크 — 인증 메일 보내기 전에 거름.
  // service-role 로 체크 (회원가입 전이라 RLS 영향 X 한 번 더 확실히)
  const sa = getSupabaseAdminClient();
  if (await isNicknameTaken(sa, name)) {
    return {
      ok: false,
      reason: 'invalid',
      message: '이미 사용 중인 닉네임이에요. 다른 닉네임을 입력해주세요',
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      // user_metadata 에 닉네임 임시 저장 → verifyOtp 단계에서 users 행 insert 시 사용
      data: { name },
    },
  });

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

export async function verifyOtp(formData: FormData): Promise<VerifyOtpResult> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const token = String(formData.get('token') ?? '').trim();

  // Supabase OTP token 길이는 dashboard 설정에 따름 (4~10). 6 or 8 자리 둘 다 허용.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return { ok: false, reason: 'unknown', message: '인증 후 사용자 정보 없음' };
  }

  // 도메인 재검증 (이중 안전)
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return { ok: false, reason: 'unknown', message: '허용 도메인이 아니에요' };
  }

  // users 프로필 행 보장
  const { data: existing } = await supabase
    .from('users')
    .select('office_id, building_id, password_set')
    .eq('id', user.id)
    .maybeSingle();

  if (!existing) {
    const metaName =
      typeof user.user_metadata?.name === 'string'
        ? (user.user_metadata.name as string).trim()
        : '';
    const name = metaName || suggestNameFromEmail(user.email);

    // D53: requestOtp 와 verifyOtp 사이에 누군가 같은 닉네임을 선점했을 수 있음 (race).
    // unique index 가 최종 방어선이지만 메시지를 친절하게.
    if (await isNicknameTaken(supabase, name)) {
      // 이메일 인증은 끝났으니 auto-suggest 로 회피값 만들어서 임시로 넣어주고 onboarding 에서 바꾸게.
      const fallback = `${name}-${user.id.slice(0, 4)}`;
      const { error: insertError } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        name: fallback,
        avatar_color: avatarColorFor(fallback + user.id),
      });
      if (insertError) {
        return { ok: false, reason: 'unknown', message: insertError.message };
      }
      redirect('/onboarding');
    }

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
