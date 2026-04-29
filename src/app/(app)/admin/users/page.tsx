import { createSupabaseServerClient } from '@/lib/supabase/server';
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
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('users')
    .select(
      'id, email, name, role, department, building:office_buildings!users_building_id_fkey ( name )',
    )
    .order('created_at', { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

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
