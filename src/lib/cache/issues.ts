// /issues 기본 목록(Open 전체 지역) 캐시. 커뮤니티 공통 데이터라 전 사용자 공유.
// open/answer/close 시 invalidateIssuesCache() 로 무효화. (탭/지역 변경은 서버액션 live 조회)
import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { fetchIssues, type IssueListItem } from '@/lib/issues/queries';

const TAG = 'issues';

export const getCachedOpenIssues = unstable_cache(
  async (): Promise<IssueListItem[]> => {
    const supabase = getSupabaseAdminClient();
    return fetchIssues(supabase, { status: 'open', office: 'all' });
  },
  ['issues-open-all'],
  { revalidate: 60 * 30, tags: [TAG] },
);

export function invalidateIssuesCache() {
  revalidateTag(TAG, 'max');
}
