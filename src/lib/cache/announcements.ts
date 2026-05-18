// D65: active 공지 캐시. (app)/layout 이 모든 페이지에서 fetch 하던 걸 캐시로.
// 전 사용자 공통 (dismiss 는 client localStorage). 작성/내리기/삭제 시 invalidate.

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const TAG = 'announcements';
const REVALIDATE_SECONDS = 60 * 60; // 1h. 변경 시 invalidate 로 즉시 무효화.

export const getCachedActiveAnnouncements = unstable_cache(
  async (): Promise<{ id: string; body: string }[]> => {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('announcements')
      .select('id, body')
      .eq('active', true)
      .order('created_at', { ascending: false });
    return (data ?? []) as { id: string; body: string }[];
  },
  ['announcements-active'],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export function invalidateAnnouncementsCache() {
  revalidateTag(TAG, 'max');
}
