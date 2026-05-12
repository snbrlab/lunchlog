// D54: 식당 목록 캐시.
// /map 진입 시점에 모든 식당 + creator join 을 매번 fetch 하던 걸 캐시로 묶음.
// 식당 수가 늘면서 / commit 누적되면서 응답 + payload 둘 다 부담이 커진다.
//
// 캐시 무효화 시점:
//  - 식당 insert (restaurants/new) / update (admin edit) / delete (admin)
//  - is_closed 토글 (admin)
//  - 리뷰 insert/delete/revert/edit — trigger 가 commit_count + last_commit_at 갱신
//    last_commit_at 이 sidebar 정렬 키라 신선도 필요
//
// 사용자별 favorite 은 별도 fetch (캐시 무관, 매 요청 fresh).

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { RestaurantListItem } from '@/types/db';

const TAG = 'restaurants';
const REVALIDATE_SECONDS = 60 * 60; // 1h. 변경 시엔 invalidateRestaurantsCache() 로 즉시 무효화.

// D55: 사이드바 + 지도 마커가 쓰는 컬럼만. 디테일 패널은 별도 단건 fetch.
const LIST_COLUMNS = [
  'id',
  'name',
  'categories',
  'cuisine_types',
  'menu_tags',
  'price_level',
  'latitude',
  'longitude',
  'is_closed',
  'commit_count',
  'last_commit_at',
  'has_alcohol',
].join(', ');

export const getCachedRestaurants = unstable_cache(
  async () => {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('restaurants')
      .select(LIST_COLUMNS)
      .order('last_commit_at', { ascending: false, nullsFirst: false });
    return (data ?? []) as unknown as RestaurantListItem[];
  },
  ['restaurants-list-v2'], // v1 (full row) 캐시와 키 분리
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export function invalidateRestaurantsCache() {
  revalidateTag(TAG, 'max');
}
