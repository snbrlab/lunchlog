'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fetchReviewLogPage, LOG_PAGE_SIZE, type LogReviewRow } from '@/lib/reviews/log';

export type LoadMoreResult = {
  rows: LogReviewRow[];
  hasMore: boolean;
};

// D64: "더 보기" — beforeIso 보다 과거 commit 한 페이지.
// 캐시 안 함 (스크롤 깊이별로 다 캐시할 가치 적음). 인증 사용자만.
export async function loadMoreReviewLog(beforeIso: string): Promise<LoadMoreResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], hasMore: false };

  const rows = await fetchReviewLogPage(supabase, {
    before: beforeIso,
    limit: LOG_PAGE_SIZE,
  });
  return { rows, hasMore: rows.length === LOG_PAGE_SIZE };
}
