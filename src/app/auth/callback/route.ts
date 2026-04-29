import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isAllowedEmail, suggestNameFromEmail } from '@/lib/auth/email-domain';
import { avatarColorFor } from '@/lib/avatar-color';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('redirect') ?? '/map';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=exchange', request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL('/login?error=exchange', request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=exchange', request.url));
  }

  // 도메인 화이트리스트 검증 (D1)
  if (!isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=domain', request.url));
  }

  // users 프로필 행 보장 (없으면 생성, 있으면 그대로)
  const { data: existing } = await supabase
    .from('users')
    .select('id, office_id, building_id, password_set')
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
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?error=unknown', request.url));
    }
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  // 기존 사용자: 단계별 진입.
  if (!existing.office_id || !existing.building_id) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }
  if (!existing.password_set) {
    return NextResponse.redirect(new URL('/set-password', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
