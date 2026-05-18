// D64: /log 첫 페이지 캐시. 전 사용자 공통 데이터 (office 필터는 client-side).
// createReview / deleteReview / revertReview 에서 invalidateReviewsLogCache() 호출.

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchReviewLogPage, LOG_PAGE_SIZE, type LogReviewRow } from '@/lib/reviews/log';

const TAG = 'reviews-log';
const REVALIDATE_SECONDS = 60 * 30; // 30분. 변경 시 invalidate 로 즉시 무효화.

export const getCachedRecentReviewLog = unstable_cache(
  async (): Promise<LogReviewRow[]> => {
    const supabase = getSupabaseAdminClient();
    return fetchReviewLogPage(supabase, { limit: LOG_PAGE_SIZE });
  },
  ['reviews-log-first-page'],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export function invalidateReviewsLogCache() {
  revalidateTag(TAG, 'max');
}
