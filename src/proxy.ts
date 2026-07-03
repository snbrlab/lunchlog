// 인증 + 온보딩 가드 (Next 16 proxy convention, 구 middleware)
// /login, /signup, /forgot-password, /auth/* 외 모든 경로는 인증 + 온보딩 완료 체크.
// (/reset-password 는 인증 필요 — auth/callback 통해 들어와야 정상 동작)

import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// /c/* 는 커밋 공유 랜딩(+og 이미지) — 크롤러가 로그인에 안 튕기게 공개.
const PUBLIC_PATHS = ['/login', '/signup', '/forgot-password', '/auth', '/c'];
const ONBOARDING_PATH = '/onboarding';
const SET_PASSWORD_PATH = '/set-password';

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { response, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('office_id, building_id, password_set')
    .eq('id', user.id)
    .maybeSingle();

  const onboarded = Boolean(profile?.office_id && profile?.building_id);
  const passwordSet = Boolean(profile?.password_set);

  // 1단계: 온보딩 미완료 → /onboarding 강제
  if (!onboarded && pathname !== ONBOARDING_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = ONBOARDING_PATH;
    return NextResponse.redirect(url);
  }

  // 2단계: 비번 미설정 → /set-password 강제 (온보딩은 끝났을 때)
  if (onboarded && !passwordSet && pathname !== SET_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = SET_PASSWORD_PATH;
    return NextResponse.redirect(url);
  }

  // 이미 끝낸 단계로 다시 들어오면 /map 으로
  if (onboarded && pathname === ONBOARDING_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = passwordSet ? '/map' : SET_PASSWORD_PATH;
    return NextResponse.redirect(url);
  }
  if (passwordSet && pathname === SET_PASSWORD_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = '/map';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // 정적 자산 / Next 내부 / 이미지는 제외
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
