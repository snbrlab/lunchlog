'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { allCuisineValues } from '@/lib/cuisine';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';
import { invalidateReviewsLogCache } from '@/lib/cache/reviews-log';
import type { CuisineType, MealMode } from '@/types/db';

function isAllowedKakaoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'place.map.kakao.com' || u.hostname.endsWith('.kakao.com');
  } catch {
    return false;
  }
}

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
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return { ok: false, message: '관리자만 폐업 처리가 가능해요' };
  }

  const { error } = await supabase
    .from('restaurants')
    .update({
      is_closed: nextClosed,
      // /log 아카이브 이벤트의 시간축. 폐업 해제하면 이벤트도 사라지도록 null.
      closed_at: nextClosed ? new Date().toISOString() : null,
    })
    .eq('id', restaurantId);

  if (error) return { ok: false, message: error.message };
  invalidateRestaurantsCache();
  invalidateReviewsLogCache(); // /log 아카이브 이벤트 갱신
  return { ok: true, isClosed: nextClosed };
}

interface UpdateRestaurantInput {
  id: string;
  name: string;
  categories: MealMode[];
  cuisineTypes: CuisineType[];
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
  if (!name) return { ok: false, reason: 'invalid', message: '이름은 필수예요' };
  if (input.categories.length === 0) {
    return { ok: false, reason: 'invalid', message: '점심/저녁 중 최소 1개를 선택해주세요' };
  }
  for (const c of input.categories) {
    if (c !== 'lunch' && c !== 'dinner')
      return { ok: false, reason: 'invalid', message: '잘못된 카테고리예요' };
  }
  if (input.cuisineTypes.length === 0) {
    return { ok: false, reason: 'invalid', message: '음식 종류를 최소 1개 선택해주세요' };
  }
  const validCuisines = new Set(allCuisineValues(await getCachedCuisineItems()));
  for (const c of input.cuisineTypes) {
    if (!validCuisines.has(c)) {
      return { ok: false, reason: 'invalid', message: '잘못된 음식 종류예요' };
    }
  }
  // 중복 제거
  const dedupCuisines = Array.from(new Set(input.cuisineTypes));
  if (![1, 2, 3].includes(input.priceLevel)) {
    return { ok: false, reason: 'invalid', message: '가격대는 1~3 사이여야 해요' };
  }
  if (input.menuTags.some((t) => t.length > 30)) {
    return { ok: false, reason: 'invalid', message: '태그는 30자 이내로 입력해주세요' };
  }
  if ((input.recommendedMinSize == null) !== (input.recommendedMaxSize == null)) {
    return { ok: false, reason: 'invalid', message: '추천 인원은 둘 다 비우거나 둘 다 입력해주세요' };
  }
  if (input.recommendedMinSize != null && input.recommendedMaxSize != null) {
    if (
      input.recommendedMinSize < 1 ||
      input.recommendedMaxSize > 99 ||
      input.recommendedMinSize > input.recommendedMaxSize
    ) {
      return { ok: false, reason: 'invalid', message: '추천 인원 범위가 잘못됐어요' };
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
    return { ok: false, reason: 'invalid', message: '좌표가 올바르지 않아요' };
  }
  if (!input.address.trim()) {
    return { ok: false, reason: 'invalid', message: '주소를 입력해주세요' };
  }
  if (input.kakaoPlaceUrl && !isAllowedKakaoUrl(input.kakaoPlaceUrl)) {
    return { ok: false, reason: 'invalid', message: '카카오 url 만 허용돼요' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'forbidden', message: '로그인이 필요해요' };

  // 권한 사전 검증 (RLS 도 차단하지만 UX 명확화)
  const [{ data: existing }, { data: profile }] = await Promise.all([
    supabase.from('restaurants').select('created_by').eq('id', input.id).maybeSingle(),
    supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
  ]);
  if (!existing) return { ok: false, reason: 'invalid', message: '식당이 없어요' };
  const isOwner = existing.created_by === user.id;
  const isAdmin = profile?.role === 'admin';
  if (!isOwner && !isAdmin) {
    return { ok: false, reason: 'forbidden', message: '본인이 등록한 식당 또는 admin 만 수정할 수 있어요' };
  }

  const { error } = await supabase
    .from('restaurants')
    .update({
      name,
      categories: input.categories,
      cuisine_types: dedupCuisines,
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
  invalidateRestaurantsCache();
  invalidateReviewsLogCache(); // 이름/cuisine 변경이 /log 카드 스냅샷에 반영되게
  redirect('/map');
}
