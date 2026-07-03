// 커밋(한줄평) 공유 카드용 데이터 fetch.
// /c/[id] 는 인증 밖 공개 라우트라 일반 클라이언트로는 restaurants RLS(authenticated)를
// 못 뚫음 → service-role 클라이언트로 카드에 필요한 최소 필드만 읽음.

import { cache } from 'react';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface CommitCard {
  message: string;
  author: string;
  mealTime: 'lunch' | 'dinner';
  hash: string;
  restaurantId: string;
  restaurantName: string;
  region: string | null;
}

// cache() — 랜딩의 generateMetadata + page 가 같은 요청에서 둘 다 호출해도 DB 왕복 1회.
export const fetchCommitCard = cache(async (id: string): Promise<CommitCard | null> => {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(
      'message, meal_time, hash, reverted, ' +
        'restaurant:restaurants ( id, name, office:offices ( name ) ), ' +
        'author:users!reviews_author_id_fkey ( name )',
    )
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;

  // 타입: nested single relations
  const row = data as unknown as {
    message: string;
    meal_time: 'lunch' | 'dinner';
    hash: string;
    reverted: boolean;
    restaurant: { id: string; name: string; office: { name: string } | null } | null;
    author: { name: string } | null;
  };

  if (row.reverted || !row.restaurant) return null; // revert 됐거나 식당 삭제됨

  return {
    message: row.message,
    author: row.author?.name ?? '익명',
    mealTime: row.meal_time,
    hash: row.hash,
    restaurantId: row.restaurant.id,
    restaurantName: row.restaurant.name,
    region: row.restaurant.office?.name ?? null,
  };
});
