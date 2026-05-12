// cuisine_items 도 거의 변하지 않음 (admin 이 가끔 항목 추가/이모지 수정).
// offices/buildings 와 동일 패턴: service-role 로 한 번 fetch → 캐시 → admin 변경 시 invalidate.

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { CuisineItem } from '@/lib/cuisine';

const TAG = 'cuisine-items';
const REVALIDATE_SECONDS = 60 * 60 * 24; // 24h

export const getCachedCuisineItems = unstable_cache(
  async () => {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('cuisine_items')
      .select('value, label, emoji, group_label, display_order')
      .order('group_label')
      .order('display_order');
    return (data ?? []) as CuisineItem[];
  },
  ['cuisine-items-all'],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export function invalidateCuisineItemsCache() {
  revalidateTag(TAG, 'max');
}
