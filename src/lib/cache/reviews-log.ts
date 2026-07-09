// D64: /log 첫 페이지 캐시. 전 사용자 공통 데이터.
// 지역 필터는 DB 쿼리에서 적용되므로 지역별로 첫 페이지를 따로 캐시한다
// (지역 수는 몇 개 안 되므로 키 폭발 없음. 지역 전환 시 서버 왕복이 캐시 히트로 끝남).
// createReview / deleteReview / revertReview 등에서 invalidateReviewsLogCache() 호출 → 전부 무효화.

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchReviewLogPage, LOG_PAGE_SIZE, type LogReviewRow } from '@/lib/reviews/log';

const TAG = 'reviews-log';
const REVALIDATE_SECONDS = 60 * 30; // 30분. 변경 시 invalidate 로 즉시 무효화.

// officeId: 'all' | 'none' | office uuid
export function getCachedReviewLogFirstPage(officeId: string): Promise<LogReviewRow[]> {
  return unstable_cache(
    async (): Promise<LogReviewRow[]> => {
      const supabase = getSupabaseAdminClient();
      return fetchReviewLogPage(supabase, { limit: LOG_PAGE_SIZE, officeId });
    },
    ['reviews-log-first-page', officeId],
    { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
  )();
}

// /log SSR 초기 렌더 — 전체 지역 첫 페이지
export function getCachedRecentReviewLog(): Promise<LogReviewRow[]> {
  return getCachedReviewLogFirstPage('all');
}

export function invalidateReviewsLogCache() {
  revalidateTag(TAG, 'max');
}
