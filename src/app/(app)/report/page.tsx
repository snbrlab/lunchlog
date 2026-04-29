import { createSupabaseServerClient } from '@/lib/supabase/server';
import ReportForm from './ReportForm';
import { formatRelativeTime } from '@/lib/format-time';
import type { Report } from '@/types/db';

const STATUS_LABEL: Record<Report['status'], string> = {
  open: '접수됨',
  reviewing: '확인 중',
  resolved: '처리 완료',
};
const CATEGORY_LABEL: Record<Report['category'], string> = {
  bug: '버그',
  feature: '기능 제안',
  restaurant: '식당 오류',
  other: '기타',
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const sp = await searchParams;
  const sent = sp.sent === '1';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: myReports } = await supabase
    .from('reports')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">관리자에게 제보</h1>
      <p className="mb-6 text-xs text-fg-muted">
        버그·기능 제안·식당 정보 오류 등 의견 보내주세요. admin 이 확인하고 처리해요.
      </p>

      {sent && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ 제보 보냈어! 처리 상태는 아래 목록에서 확인 가능.
        </div>
      )}

      <ReportForm />

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-fg">내 제보 이력</h2>
        {!myReports || myReports.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-5 text-center text-xs text-fg-muted">
            아직 보낸 제보 없음
          </p>
        ) : (
          <ol className="rounded-lg border border-border">
            {(myReports as Report[]).map((r) => (
              <li
                key={r.id}
                className="border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                  <span className="rounded bg-fg/10 px-1.5 py-0.5 font-medium text-fg">
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  <span>·</span>
                  <span>{formatRelativeTime(new Date(r.created_at))}</span>
                  <span className="ml-auto rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider text-[10px] {r.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : r.status === 'reviewing' ? 'bg-amber-100 text-amber-800' : 'bg-fg/10 text-fg-muted'}">
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-fg">{r.message}</p>
                {r.admin_note && (
                  <p className="mt-2 rounded border-l-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    <span className="font-medium">admin: </span>
                    {r.admin_note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
