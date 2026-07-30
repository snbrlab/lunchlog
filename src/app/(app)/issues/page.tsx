import { getCachedOffices } from '@/lib/cache/offices';
import { fetchIssues } from '@/lib/issues/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import IssuesClient from './IssuesClient';

// 커뮤니티 Q&A. "이 식당 어때요?" / "마곡 평냉 추천" 을 묻고 서로 답한다 (git issue 메타포).
export default async function IssuesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [openIssues, offices] = await Promise.all([
    fetchIssues(supabase, { status: 'open' }),
    getCachedOffices(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">🔎 issues</h1>
      <p className="mt-1 text-xs text-fg-muted">
        궁금한 식당·지역을 물어보세요. 아는 사람이 답해줄 거예요.
      </p>
      <div className="mt-5">
        <IssuesClient
          initialIssues={openIssues}
          offices={offices}
          currentUserId={user?.id ?? ''}
        />
      </div>
    </main>
  );
}
