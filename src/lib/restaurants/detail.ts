// D55: 디테일 패널 전용 컬럼을 단건으로 fetch.
// /map 캐시는 slim 으로 줄여서 첫 로딩을 가볍게 하고, 사용자가 핀/사이드바에서
// 식당 선택할 때만 이 fetch 가 일어남.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RestaurantDetailExtra {
  address: string;
  note: string | null;
  office_id: string | null;
  created_by: string | null;
  created_at: string;
  recommended_min_size: number | null;
  recommended_max_size: number | null;
  kakao_place_url: string | null;
  creator: {
    name: string;
    avatar_emoji: string | null;
    avatar_color: string;
  } | null;
}

const DETAIL_COLUMNS =
  'address, note, office_id, created_by, created_at, recommended_min_size, ' +
  'recommended_max_size, kakao_place_url, ' +
  'creator:users!restaurants_created_by_fkey ( name, avatar_emoji, avatar_color )';

export async function fetchRestaurantDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<RestaurantDetailExtra | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return data as unknown as RestaurantDetailExtra;
}
