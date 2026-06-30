// D82: 개발자 모드 — 가상 터미널.
// 사옥/meal/cuisine/식당 트리 + git log 등. 정체성 강화용 fun mode.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedOffices } from '@/lib/cache/offices';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { Terminal } from './Terminal';
import type { DevRestaurant, DevReview } from '@/lib/dev/fs';

// dev 모드는 power user 용 — 전체 리뷰 다 받음 (현재 약 2k 규모, ~400KB).
// Supabase PostgREST 기본 1000 cap 회피 위해 명시적 큰 limit. 5천 넘으면 페이징 검토.
const REVIEW_LIMIT = 5000;

export default async function DevPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: rawRestaurants }, { data: rawReviews }, offices, cuisineItems] = await Promise.all([
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
  ]);

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
        offices={offices}
        cuisineItems={cuisineItems}
      />
    </main>
  );
}
