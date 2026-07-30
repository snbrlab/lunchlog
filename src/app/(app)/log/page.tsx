import { getCachedOffices } from '@/lib/cache/offices';
import { getCachedRecentReviewLog } from '@/lib/cache/reviews-log';
import { LOG_PAGE_SIZE } from '@/lib/reviews/log';
import { fetchRecentPullRequestEvents } from '@/lib/pull-requests/events';
import { fetchRecentArchiveEvents } from '@/lib/restaurants/archive-events';
import { fetchRecentIssueEvents } from '@/lib/issues/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import LogList from './LogList';

// 사내 commit log. /log — 모든 사용자가 최근 활동을 한 화면에 모아봄.
// D64: 첫 페이지는 캐시 (전 사용자 공통). "더 보기" 로 과거 commit keyset 페이지네이션.
// D78: PR 이벤트도 같이 표시 — git activity feed 느낌.
export default async function LogPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [rows, offices, prEvents, archiveEvents, issueEvents] = await Promise.all([
    getCachedRecentReviewLog(),
    getCachedOffices(),
    fetchRecentPullRequestEvents(supabase),
    fetchRecentArchiveEvents(supabase),
    fetchRecentIssueEvents(supabase),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">📜 최근 commit log</h1>
      <p className="mt-1 text-xs text-fg-muted">
        최근 {LOG_PAGE_SIZE}건부터. 동료들이 어디 가고 있는지 한 눈에.
      </p>
      <div className="mt-5">
        <LogList
          initialRows={rows}
          prEvents={prEvents}
          archiveEvents={archiveEvents}
          issueEvents={issueEvents}
          offices={offices}
          currentUserId={user?.id ?? ''}
        />
      </div>
    </main>
  );
}
