import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import UsersTable from './UsersTable';

interface Row {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'admin';
  department: string | null;
  building: { name: string } | null;
}

export default async function AdminUsersPage() {
  // admin 가드는 (app)/admin/layout 에서 했지만 한 번 더 (D50: email 노출 보호)
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

  // service-role 로 email 까지 fetch (column GRANT 우회)
  const sa = getSupabaseAdminClient();
  const { data } = await sa
    .from('users')
    .select(
      'id, email, name, role, department, building:office_buildings!users_building_id_fkey ( name )',
    )
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">사용자 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        admin 권한 부여/회수. 본인 admin 권한 회수는 다른 admin 만 가능.
      </p>
      <UsersTable
        rows={((data ?? []) as unknown) as Row[]}
        currentUserId={user?.id ?? ''}
      />
    </main>
  );
}
