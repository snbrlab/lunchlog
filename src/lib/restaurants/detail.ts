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
  // 공유 텍스트용 최신 한줄평 (top-level, non-reverted) 최대 3개
  topReviews: { message: string; author: string }[];
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

  // 공유 텍스트용 최신 한줄평 — top-level(답글 제외), non-reverted 3개
  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('message, author:users!reviews_author_id_fkey ( name )')
    .eq('restaurant_id', id)
    .eq('reverted', false)
    .is('parent_review_id', null)
    .order('created_at', { ascending: false })
    .limit(3);

  const topReviews = (
    (reviewRows ?? []) as unknown as { message: string; author: { name: string } | null }[]
  )
    .map((r) => ({ message: r.message.trim(), author: r.author?.name ?? '' }))
    .filter((r) => r.message.length > 0);

  return { ...(data as unknown as RestaurantDetailExtra), topReviews };
}
