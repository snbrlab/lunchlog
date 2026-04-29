'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ALL_CUISINES } from '@/lib/cuisine';
import type { CuisineType, MealMode } from '@/types/db';

export type ToggleClosedResult =
  | { ok: true; isClosed: boolean }
  | { ok: false; message: string };

export type UpdateRestaurantResult =
  | { ok: false; reason: 'invalid' | 'forbidden' | 'unknown'; message: string };
// 성공 시 redirect 로 빠져나가서 client 까지 도달하지 않음.

// 폐업 토글 — admin only (D9 보강).
export async function toggleRestaurantClosed(
  restaurantId: string,
  nextClosed: boolean,
): Promise<ToggleClosedResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해' };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false, message: '관리자만 폐업 처리 가능' };
  }

  const { error } = await supabase
    .from('restaurants')
    .update({ is_closed: nextClosed })
    .eq('id', restaurantId);

  if (error) return { ok: false, message: error.message };
  return { ok: true, isClosed: nextClosed };
}

interface UpdateRestaurantInput {
  id: string;
  name: string;
  categories: MealMode[];
  cuisineType: CuisineType;
  menuTags: string[];
  priceLevel: 1 | 2 | 3;
  note: string | null;
  recommendedMinSize: number | null;
  recommendedMaxSize: number | null;
  hasAlcohol: boolean;
  // 좌표/주소/카카오 url — 카카오 검색으로 다시 선택 시 변경
  latitude: number;
  longitude: number;
  address: string;
  kakaoPlaceUrl: string | null;
}

export async function updateRestaurant(
  input: UpdateRestaurantInput,
): Promise<UpdateRestaurantResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, reason: 'invalid', message: '이름 필수' };
  if (input.categories.length === 0) {
    return { ok: false, reason: 'invalid', message: '점심/저녁 중 최소 1개' };
  }
  for (const c of input.categories) {
    if (c !== 'lunch' && c !== 'dinner')
      return { ok: false, reason: 'invalid', message: '잘못된 카테고리' };
  }
  if (!(ALL_CUISINES as readonly string[]).includes(input.cuisineType)) {
    return { ok: false, reason: 'invalid', message: '잘못된 음식 종류' };
  }
  if (![1, 2, 3].includes(input.priceLevel)) {
    return { ok: false, reason: 'invalid', message: '가격대는 1~3' };
  }
  if (input.menuTags.some((t) => t.length > 30)) {
    return { ok: false, reason: 'invalid', message: '태그는 30자 이내' };
  }
  if ((input.recommendedMinSize == null) !== (input.recommendedMaxSize == null)) {
    return { ok: false, reason: 'invalid', message: '추천 인원은 둘 다 비우거나 둘 다 입력' };
  }
  if (input.recommendedMinSize != null && input.recommendedMaxSize != null) {
    if (
      input.recommendedMinSize < 1 ||
      input.recommendedMaxSize > 99 ||
      input.recommendedMinSize > input.recommendedMaxSize
    ) {
      return { ok: false, reason: 'invalid', message: '추천 인원 범위 오류' };
    }
  }
  if (
    !Number.isFinite(input.latitude) ||
    !Number.isFinite(input.longitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    return { ok: false, reason: 'invalid', message: '좌표가 올바르지 않아' };
  }
  if (!input.address.trim()) {
    return { ok: false, reason: 'invalid', message: '주소를 입력해줘' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'forbidden', message: '로그인이 필요해' };

  // 권한 사전 검증 (RLS 도 차단하지만 UX 명확화)
  const [{ data: existing }, { data: profile }] = await Promise.all([
    supabase.from('restaurants').select('created_by').eq('id', input.id).maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ]);
  if (!existing) return { ok: false, reason: 'invalid', message: '식당이 없어' };
  const isOwner = existing.created_by === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isOwner && !isAdmin) {
    return { ok: false, reason: 'forbidden', message: '본인 등록 식당 또는 admin 만 수정 가능' };
  }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name,
      categories: input.categories,
      cuisine_type: input.cuisineType,
      menu_tags: input.menuTags.filter((t) => t.length > 0),
      price_level: input.priceLevel,
      note: input.note?.trim() || null,
      recommended_min_size: input.recommendedMinSize,
      recommended_max_size: input.recommendedMaxSize,
      has_alcohol: input.hasAlcohol,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address.trim(),
      kakao_place_url: input.kakaoPlaceUrl,
    })
    .eq('id', input.id);

  if (error) return { ok: false, reason: 'unknown', message: error.message };
  redirect('/map');
}
