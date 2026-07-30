import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchIssueDetail } from '@/lib/issues/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import IssueThread from './IssueThread';

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const issue = await fetchIssueDetail(supabase, id);
  if (!issue) notFound();

  // 닫기 권한 — 작성자 또는 admin
  let isAdmin = false;
  if (user) {
    const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
    isAdmin = me?.role === 'admin';
  }
  const canClose = !!user && (user.id === issue.author_id || isAdmin);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/issues" className="text-xs text-fg-muted hover:underline">
        ← issues
      </Link>
      <div className="mt-3">
        <IssueThread issue={issue} canClose={canClose} />
      </div>
    </main>
  );
}
