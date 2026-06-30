// D82: 개발자 모드 — 가상 터미널.
// 사옥/meal/cuisine/식당 트리 + git log 등. 정체성 강화용 fun mode.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedOffices, getCachedBuildings } from '@/lib/cache/offices';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { fetchRecentPullRequestEvents } from '@/lib/pull-requests/events';
import { Terminal } from './Terminal';
import type { DevRestaurant, DevReview } from '@/lib/dev/fs';
import type { DevPREvent } from '@/lib/dev/commands';

// dev 모드는 power user 용 — 전체 리뷰 다 받음 (현재 약 2k 규모, ~400KB).
// Supabase PostgREST 기본 1000 cap 회피 위해 명시적 큰 limit. 5천 넘으면 페이징 검토.
const REVIEW_LIMIT = 5000;

export default async function DevPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meRow } = user
    ? await supabase
        .from('users')
        .select('name, building_id, office_id, custom_lat, custom_lng')
        .eq('id', user.id)
        .maybeSingle()
    : { data: null };
  const profile = meRow as
    | {
        name: string;
        building_id: string | null;
        office_id?: string | null;
        custom_lat: number | null;
        custom_lng: number | null;
      }
    | null;
  const currentUserName = profile?.name ?? '익명';

  // origin: custom_lat/lng > building > fallback (서울)
  const buildings = await getCachedBuildings();
  const building = buildings.find((b) => b.id === profile?.building_id);
  const originLat =
    profile?.custom_lat ?? building?.latitude ?? 37.5604;
  const originLng =
    profile?.custom_lng ?? building?.longitude ?? 126.8255;

  const [{ data: rawRestaurants }, { data: rawReviews }, offices, cuisineItems, prRawEvents] = await Promise.all([
    supabase
      .from('restaurants')
      .select(
        'id, name, cuisine_types, categories, price_level, has_alcohol, address, ' +
          'latitude, longitude, kakao_place_url, office_id, commit_count, last_commit_at, ' +
          'created_at, menu_tags, creator:users!restaurants_created_by_fkey ( name )',
      )
      .eq('is_closed', false)
      .order('name'),
    supabase
      .from('reviews')
      .select(
        'id, restaurant_id, hash, message, meal_time, party_size, reverted, ' +
          'parent_review_id, created_at, author:users!reviews_author_id_fkey ( name )',
      )
      .order('created_at', { ascending: false })
      .limit(REVIEW_LIMIT),
    getCachedOffices(),
    getCachedCuisineItems(),
    fetchRecentPullRequestEvents(supabase),
  ]);

  // PR 이벤트를 dev mode shape 로 변환
  const prEvents: DevPREvent[] = prRawEvents.map((p) => ({
    pr_id: p.pr_id,
    pr_kind: p.pr_kind,
    event: p.event,
    source_name: p.source_name,
    target_name: p.target_name,
    target_id: p.target_id,
    actor_name: p.actor?.name ?? null,
    edit_field: p.edit_payload?.field ?? null,
    at: p.at,
  }));

  type RawR = Omit<DevRestaurant, 'creator_name'> & {
    creator: { name: string } | null;
  };
  const restaurants: DevRestaurant[] = ((rawRestaurants ?? []) as unknown as RawR[]).map((r) => ({
    id: r.id,
    name: r.name,
    cuisine_types: r.cuisine_types,
    categories: r.categories,
    price_level: r.price_level,
    has_alcohol: r.has_alcohol,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    kakao_place_url: r.kakao_place_url,
    office_id: r.office_id,
    commit_count: r.commit_count,
    last_commit_at: r.last_commit_at,
    created_at: r.created_at,
    menu_tags: r.menu_tags ?? [],
    creator_name: r.creator?.name ?? null,
  }));

  type RawV = Omit<DevReview, 'author_name'> & { author: { name: string } | null };
  const reviews: DevReview[] = ((rawReviews ?? []) as unknown as RawV[]).map((r) => ({
    id: r.id,
    restaurant_id: r.restaurant_id,
    hash: r.hash,
    message: r.message,
    meal_time: r.meal_time,
    party_size: r.party_size,
    reverted: r.reverted,
    parent_review_id: r.parent_review_id,
    created_at: r.created_at,
    author_name: r.author?.name ?? null,
  }));

  return (
    <main className="flex h-[calc(100dvh-5rem)] flex-col bg-black p-2 sm:p-4">
      <Terminal
        restaurants={restaurants}
        reviews={reviews}
        prEvents={prEvents}
        offices={offices}
        cuisineItems={cuisineItems}
        currentUserName={currentUserName}
        currentOfficeName={offices.find((o) => o.id === profile?.office_id)?.name ?? null}
        originLat={originLat}
        originLng={originLng}
      />
    </main>
  );
}
