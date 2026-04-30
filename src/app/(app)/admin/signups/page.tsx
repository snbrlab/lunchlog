import { createSupabaseServerClient } from '@/lib/supabase/server';
import SignupsTable from './SignupsTable';

export interface SignupRow {
  id: string;
  email: string;
  name: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  reviewed_at: string | null;
  denied_reason: string | null;
  reviewer: { name: string } | null;
}

export default async function AdminSignupsPage() {
  const supabase = await createSupabaseServerClient();

  // 최근 50개 (pending 우선, 그 다음 최신순)
  const { data } = await supabase
    .from('signup_requests')
    .select(
      'id, email, name, status, requested_at, reviewed_at, denied_reason, reviewer:users!signup_requests_reviewed_by_fkey ( name )',
    )
    .order('status', { ascending: true }) // approved < denied < pending 알파벳순이라 따로 정렬
    .order('requested_at', { ascending: false })
    .limit(50);

  // pending 을 최상단으로 강제 정렬 (DB 정렬은 알파벳순이라)
  const rows = ((data ?? []) as unknown as SignupRow[]).sort((a, b) => {
    const order = { pending: 0, denied: 1, approved: 2 };
    return order[a.status] - order[b.status];
  });

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">
        가입 요청
        {pendingCount > 0 && (
          <span className="ml-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
            {pendingCount} 대기
          </span>
        )}
      </h1>
      <p className="mb-6 text-xs text-fg-muted">
        승인하면 사용자 자신이 설정한 비번으로 로그인 가능. 거절하면 auth 계정도 같이 정리됨.
      </p>
      <SignupsTable rows={rows} />
    </main>
  );
}
