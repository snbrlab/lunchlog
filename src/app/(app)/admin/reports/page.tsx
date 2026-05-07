import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import ReportsAdminTable from './ReportsAdminTable';

interface Row {
  id: string;
  category: 'bug' | 'feature' | 'restaurant' | 'other';
  message: string;
  status: 'open' | 'reviewing' | 'resolved';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  author: { name: string; email: string } | null;
}

export default async function AdminReportsPage() {
  // admin 가드 (D50: author email 노출 보호)
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (me?.role !== 'admin') redirect('/map');

  // service-role 로 author email 까지 fetch
  const sa = getSupabaseAdminClient();
  const { data } = await sa
    .from('reports')
    .select(
      'id, category, message, status, admin_note, created_at, resolved_at, ' +
        'author:users!reports_author_id_fkey ( name, email )',
    )
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">제보 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        사용자 제보 확인 + 상태 토글 (open / reviewing / resolved) + admin 메모.
      </p>
      <ReportsAdminTable rows={(data ?? []) as unknown as Row[]} />
    </main>
  );
}
