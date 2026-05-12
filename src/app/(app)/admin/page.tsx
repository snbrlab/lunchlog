import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();
  const [r, u, rv, b] = await Promise.all([
    supabase.from('restaurants').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('reviews').select('id', { count: 'exact', head: true }),
    supabase.from('office_buildings').select('id', { count: 'exact', head: true }),
  ]);

  const stats = [
    { label: '식당', count: r.count ?? 0 },
    { label: '리뷰 (commit)', count: rv.count ?? 0 },
    { label: '사용자', count: u.count ?? 0 },
    { label: '건물', count: b.count ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-fg">대시보드</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs text-fg-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{s.count}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 space-y-2 text-sm text-fg-muted">
        <h2 className="text-base font-medium text-fg">바로가기</h2>
        <ul className="list-inside list-disc space-y-1 text-xs">
          <li>건물 좌표 자동 보정 / 수동 편집 → /admin/buildings</li>
          <li>식당 일괄 관리 (폐업·삭제) → /admin/restaurants</li>
          <li>음식 카테고리 추가/수정 → /admin/cuisines</li>
          <li>사용자 권한 (admin 부여/회수) → /admin/users</li>
        </ul>
      </section>
    </main>
  );
}
