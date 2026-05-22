import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatRelativeTime } from '@/lib/format-time';

// D71: 지역별 대장 명단 — admin 만.
export default async function AdminChampionsPage() {
  // admin 가드
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

  // service-role 로 office, region_champions, user 다 fetch
  const sa = getSupabaseAdminClient();
  const [{ data: offices }, { data: champs }] = await Promise.all([
    sa.from('offices').select('id, name').order('name'),
    sa
      .from('region_champions')
      .select(
        'office_id, commit_count, since_at, user:users!region_champions_user_id_fkey ( id, name, email )',
      ),
  ]);

  type Champ = {
    office_id: string;
    commit_count: number;
    since_at: string;
    user: { id: string; name: string; email: string } | null;
  };
  const champByOffice = new Map<string, Champ>();
  for (const c of (champs ?? []) as unknown as Champ[]) {
    champByOffice.set(c.office_id, c);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">👑 지역별 대장</h1>
      <p className="mb-6 text-xs text-fg-muted">
        office 의 식당에 활성 commit 1위. <strong>최소 10 commit</strong> 이상 + admin 제외.
        리뷰 변동 시 자동 재계산.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">지역</th>
              <th className="px-3 py-2 text-left">대장</th>
              <th className="px-3 py-2 text-left">이메일</th>
              <th className="px-3 py-2 text-right">commit</th>
              <th className="px-3 py-2 text-left">즉위</th>
            </tr>
          </thead>
          <tbody>
            {(offices ?? []).map((o) => {
              const c = champByOffice.get(o.id);
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-fg">{o.name}</td>
                  {c ? (
                    <>
                      <td className="px-3 py-2">
                        {c.user ? (
                          <Link
                            href={`/u/${c.user.id}`}
                            className="font-medium text-fg hover:underline"
                          >
                            👑 {c.user.name}
                          </Link>
                        ) : (
                          <span className="text-fg-muted">(사용자 삭제됨)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-fg-muted">
                        {c.user?.email ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-fg">
                        {c.commit_count}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-fg-muted">
                        {formatRelativeTime(new Date(c.since_at))}
                      </td>
                    </>
                  ) : (
                    <td
                      colSpan={4}
                      className="px-3 py-2 text-center text-xs text-fg-muted/60"
                    >
                      아직 왕좌 비어있음 (10 commit 컷 미충족)
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
