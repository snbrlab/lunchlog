'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchReviewLogPage, LOG_PAGE_SIZE, type LogReviewRow } from '@/lib/reviews/log';

export type LoadMoreResult = {
  rows: LogReviewRow[];
  hasMore: boolean;
};

// D64: /log 한 페이지 fetch. 캐시 안 함 (스크롤 깊이/지역별로 다 캐시할 가치 적음). 인증 사용자만.
//
// officeId: 'all' | 'none' | office uuid — 지역 필터는 DB 에서 걸러야 한다.
//   (클라이언트 필터링이면 한 지역이 최신 100개를 다 먹었을 때 다른 지역이 빈 것처럼 보임)
// beforeIso: 없으면 첫 페이지, 있으면 그 시각보다 과거 (keyset cursor).
export async function loadReviewLogPage(
  officeId: string,
  beforeIso?: string,
): Promise<LoadMoreResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], hasMore: false };

  const rows = await fetchReviewLogPage(supabase, {
    before: beforeIso,
    limit: LOG_PAGE_SIZE,
    officeId,
  });
  return { rows, hasMore: rows.length === LOG_PAGE_SIZE };
}
