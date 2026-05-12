import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// 관리자 전용 영역. role !== 'admin' 이면 /map 으로.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') redirect('/map');

  return (
    <div className="flex flex-1 flex-col bg-bg">
      <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-surface px-5 py-2 text-xs">
        <span className="mr-3 font-semibold uppercase tracking-wider text-fg">⚙️ Admin</span>
        <AdminNavLink href="/admin">대시보드</AdminNavLink>
        <AdminNavLink href="/admin/buildings">건물</AdminNavLink>
        <AdminNavLink href="/admin/restaurants">식당</AdminNavLink>
        <AdminNavLink href="/admin/reviews">리뷰</AdminNavLink>
        <AdminNavLink href="/admin/users">사용자</AdminNavLink>
        {/* D47: 가입 요청 흐름 (D38) → OTP 자동 가입으로 대체. nav 에서 숨김.
            url 직접 진입은 가능 — 과거 pending 처리 등 롤백용으로 보존 */}
        <AdminNavLink href="/admin/reports">제보</AdminNavLink>
        <AdminNavLink href="/admin/announcements">공지</AdminNavLink>
        <Link
          href="/map"
          className="ml-auto rounded px-2 py-1 text-fg-muted hover:bg-fg/5 hover:text-fg"
        >
          ← 일반 화면으로
        </Link>
      </nav>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded px-2 py-1 text-fg-muted transition hover:bg-fg/5 hover:text-fg"
    >
      {children}
    </Link>
  );
}
