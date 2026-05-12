import { createSupabaseServerClient } from '@/lib/supabase/server';
import AnnouncementsTable from './AnnouncementsTable';

// D59: admin 직접 작성하는 공지 (상단 배너)
export default async function AdminAnnouncementsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('announcements')
    .select(
      'id, body, active, created_at, ' +
        'creator:users!announcements_created_by_fkey ( name )',
    )
    .order('created_at', { ascending: false });

  type Row = {
    id: string;
    body: string;
    active: boolean;
    created_at: string;
    creator: { name: string } | null;
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">📣 공지 배너</h1>
      <p className="mb-6 text-xs text-fg-muted">
        헤더 아래 sticky 한 줄로 표시. active 인 것만 노출. 사용자별로 한 번 ✕ 누르면
        그 공지는 다시 안 보임 (localStorage). 새 공지 만들면 다시 노출.
      </p>
      <AnnouncementsTable rows={((data ?? []) as unknown) as Row[]} />
    </main>
  );
}
