'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateCommitHash } from '@/lib/hash';
import { haversineDistanceMeters } from '@/lib/distance';
import { allCuisineValues } from '@/lib/cuisine';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';
import { invalidateReviewsLogCache } from '@/lib/cache/reviews-log';
import type { CuisineType, MealMode } from '@/types/db';

interface CreateRestaurantInput {
  name: string;
  categories: MealMode[];
  cuisineTypes: CuisineType[];
  menuTags: string[];
  priceLevel: 1 | 2 | 3;
  latitude: number;
  longitude: number;
  address: string;
  note: string | null;
  recommendedMinSize: number | null;
  recommendedMaxSize: number | null;
  hasAlcohol: boolean;
  kakaoPlaceUrl: string | null;

  // 첫 리뷰
  firstReviewMessage: string;
  firstReviewMealTime: MealMode;
  firstReviewPartySize: number | null;

  // 50m 동일 cuisine 식당이 있어도 새로 등록 강제
  forceCreate?: boolean;
}

export type CreateRestaurantResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate'; candidate: { id: string; name: string; meters: number } }
  | { ok: false; reason: 'invalid' | 'unknown'; message: string };

const NEAR_RADIUS_M = 50;

// 카카오 places 의 place_url 만 허용. 사용자가 임의 외부 url (피싱) 못 박게.
function isAllowedKakaoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return (
      u.hostname === 'place.map.kakao.com' ||
      u.hostname === 'map.kakao.com' ||
      u.hostname.endsWith('.kakao.com')
    );
  } catch {
    return false;
  }
}

export async function createRestaurant(
  input: CreateRestaurantInput,
): Promise<CreateRestaurantResult> {
  // ----- 검증 -----
  const name = input.name.trim();
  if (!name) return { ok: false, reason: 'invalid', message: '이름을 입력해주세요' };
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
  const dedupCuisines = Array.from(new Set(input.cuisineTypes));
  if (![1, 2, 3].includes(input.priceLevel)) {
    return { ok: false, reason: 'invalid', message: '가격대는 1~3 사이여야 해요' };
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
  if (input.menuTags.some((t) => t.length > 30)) {
    return { ok: false, reason: 'invalid', message: '태그는 30자 이내로 입력해주세요' };
  }
  // 카카오 도메인 외 url 차단 (피싱 방지)
  if (input.kakaoPlaceUrl && !isAllowedKakaoUrl(input.kakaoPlaceUrl)) {
    return { ok: false, reason: 'invalid', message: '카카오 검색 결과 url 만 허용돼요' };
  }

  const reviewMessage = input.firstReviewMessage.trim();
  if (!reviewMessage) {
    return { ok: false, reason: 'invalid', message: '첫 한 줄 리뷰는 필수예요' };
  }
  if (reviewMessage.length > 200) {
    return { ok: false, reason: 'invalid', message: '리뷰는 200자 이내로 입력해주세요' };
  }

  // recommended size
  if (
    (input.recommendedMinSize == null) !== (input.recommendedMaxSize == null)
  ) {
    return { ok: false, reason: 'invalid', message: '추천 인원은 둘 다 비우거나 둘 다 입력해주세요' };
  }
  if (input.recommendedMinSize != null && input.recommendedMaxSize != null) {
    if (input.recommendedMinSize < 1 || input.recommendedMaxSize > 99) {
      return { ok: false, reason: 'invalid', message: '추천 인원은 1~99 사이여야 해요' };
    }
    if (input.recommendedMinSize > input.recommendedMaxSize) {
      return { ok: false, reason: 'invalid', message: '추천 인원 min > max 예요' };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'invalid', message: '로그인이 필요해요' };

  const { data: profile } = await supabase
    .from('users')
    .select('office_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.office_id) {
    return { ok: false, reason: 'invalid', message: '온보딩이 먼저 필요해요' };
  }

  // ----- 50m 중복 검사 -----
  // D62: 이전엔 `.overlaps(cuisine_types)` 로 같은 cuisine 만 후보로 잡았는데,
  //      "발산한우곱해장 한식" / "발산한우곱해장 해장국" 처럼 cuisine 만 다르면
  //      검사 자체에서 빠져나가 중복 등록되는 사고. → 이름 매칭 우선으로 변경.
  //
  // 우선순위:
  //   1) 50m 내 + 정규화한 이름이 동일 → 무조건 중복 (cuisine 무관)
  //   2) 50m 내 + cuisine_types 교집합 존재 → 중복 (기존 규칙)
  //   3) 둘 다 아니면 등록 허용 (같은 건물의 다른 종류 식당은 정상)
  if (!input.forceCreate) {
    const latDelta = NEAR_RADIUS_M / 111_000;
    const lngDelta = NEAR_RADIUS_M / (111_000 * Math.cos((input.latitude * Math.PI) / 180));

    // cuisine 필터 제거 — 50m 내 모든 후보 가져와서 클라이언트에서 분기
    // office_id 필터도 없음 (D43): 다른 사무실 사람이 등록한 식당도 중복 잡아줌.
    const { data: candidates } = await supabase
      .from('restaurants')
      .select('id, name, latitude, longitude, cuisine_types, is_closed')
      .eq('is_closed', false)
      .gte('latitude', input.latitude - latDelta)
      .lte('latitude', input.latitude + latDelta)
      .gte('longitude', input.longitude - lngDelta)
      .lte('longitude', input.longitude + lngDelta);

    type Candidate = {
      id: string;
      name: string;
      latitude: number;
      longitude: number;
      cuisine_types: string[];
    };

    const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase();
    const inputNameNorm = normalize(name);
    const inputCuisineSet = new Set<string>(dedupCuisines);

    let nameMatch: Candidate | null = null;
    let cuisineMatch: Candidate | null = null;

    for (const c of (candidates ?? []) as Candidate[]) {
      const meters = haversineDistanceMeters(
        { lat: input.latitude, lng: input.longitude },
        { lat: c.latitude, lng: c.longitude },
      );
      if (meters > NEAR_RADIUS_M) continue;

      if (!nameMatch && normalize(c.name) === inputNameNorm) {
        nameMatch = c;
        break; // 이름 일치는 가장 강한 신호 — 즉시 종료
      }
      if (!cuisineMatch && c.cuisine_types.some((ct) => inputCuisineSet.has(ct))) {
        cuisineMatch = c;
      }
    }

    const hit = nameMatch ?? cuisineMatch;
    if (hit) {
      const meters = haversineDistanceMeters(
        { lat: input.latitude, lng: input.longitude },
        { lat: hit.latitude, lng: hit.longitude },
      );
      return {
        ok: false,
        reason: 'duplicate',
        candidate: { id: hit.id, name: hit.name, meters: Math.round(meters) },
      };
    }
  }

  // ----- 식당 insert -----
  const { data: rest, error: restErr } = await supabase
    .from('restaurants')
    .insert({
      name,
      categories: input.categories,
      cuisine_types: dedupCuisines,
      menu_tags: input.menuTags.filter((t) => t.length > 0),
      price_level: input.priceLevel,
      latitude: input.latitude,
      longitude: input.longitude,
      address: input.address.trim(),
      note: input.note?.trim() || null,
      // D72: office_id 를 식당 좌표 기준 가장 가까운 office 로 자동 매핑.
      // DB 함수 nearest_office_id 호출 — buildings centroid + 15km cap 일관 적용.
      // 15km 밖이면 NULL ('미분류') — 강릉/동해/분당 식당이 서초로 잘못 박히던 버그 방지.
      office_id: await (async () => {
        const { data } = await supabase.rpc('nearest_office_id', {
          p_lat: input.latitude,
          p_lng: input.longitude,
        });
        return (data as string | null) ?? null;
      })(),
      created_by: user.id,
      recommended_min_size: input.recommendedMinSize,
      recommended_max_size: input.recommendedMaxSize,
      has_alcohol: input.hasAlcohol,
      kakao_place_url: input.kakaoPlaceUrl,
    })
    .select('id')
    .single();

  if (restErr || !rest) {
    return { ok: false, reason: 'unknown', message: restErr?.message ?? '생성에 실패했어요' };
  }

  // ----- 첫 리뷰 insert (commit_count 트리거가 자동 갱신) -----
  const { error: reviewErr } = await supabase.from('reviews').insert({
    restaurant_id: rest.id,
    author_id: user.id,
    message: reviewMessage,
    meal_time: input.firstReviewMealTime,
    party_size: input.firstReviewPartySize,
    hash: generateCommitHash(),
  });

  if (reviewErr) {
    // 식당은 이미 생성됨. 리뷰 실패는 알림만 — 식당 자체는 살아있음.
    invalidateRestaurantsCache(); // 식당은 이미 추가됐으니 캐시는 갱신
    return { ok: false, reason: 'unknown', message: `식당은 등록됐지만 첫 리뷰 작성에 실패했어요: ${reviewErr.message}` };
  }

  invalidateRestaurantsCache();
  invalidateReviewsLogCache(); // 첫 리뷰가 /log 에 떠야 함
  // /map 으로 이동. redirect() 는 NEXT_REDIRECT throw — client 의 useTransition 이 자연스럽게 종료됨.
  redirect('/map');
}
