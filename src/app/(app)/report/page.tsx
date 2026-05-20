import { createSupabaseServerClient } from '@/lib/supabase/server';
import ReportForm from './ReportForm';
import { formatRelativeTime } from '@/lib/format-time';
import { ReportThread, type CommentEntry, type ReportMeta } from '@/components/reports/ReportThread';

const STATUS_LABEL = {
  open: '접수됨',
  reviewing: '확인 중',
  resolved: '처리 완료',
} as const;
const STATUS_COLOR = {
  open: 'bg-fg/10 text-fg-muted',
  reviewing: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
} as const;
const CATEGORY_LABEL = {
  bug: '🐞 버그',
  feature: '💡 기능',
  restaurant: '🍽️ 식당',
  other: '💬 기타',
} as const;

interface ReportRow {
  id: string;
  category: keyof typeof CATEGORY_LABEL;
  message: string;
  status: keyof typeof STATUS_LABEL;
  created_at: string;
  author: { id: string; name: string | null } | null;
  comments: Array<{
    id: string;
    author_id: string | null;
    body: string;
    created_at: string;
    author: { id: string; name: string | null; role: 'member' | 'admin' } | null;
  }>;
}

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

  const { data: rawReports } = await supabase
    .from('reports')
    .select(
      'id, category, message, status, created_at, ' +
        'author:users!reports_author_id_fkey ( id, name ), ' +
        'comments:report_comments ( ' +
        '  id, author_id, body, created_at, ' +
        '  author:users!report_comments_author_id_fkey ( id, name, role ) ' +
        ')',
    )
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const reports = (rawReports ?? []) as unknown as ReportRow[];
  // 각 제보의 comments 를 시간 오름차순 정렬
  for (const r of reports) {
    r.comments.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
  }

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">관리자에게 제보</h1>
      <p className="mb-6 text-xs text-fg-muted">
        버그·기능 제안·식당 정보 오류 등 의견 보내주세요. admin 답글에 다시 응답할 수 있어요 (ping-pong).
      </p>

      {sent && (
        <div className="mb-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ 제보 보냈어! admin 응답이 오면 이 아래에서 답글 가능해요.
        </div>
      )}

      <ReportForm />

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-fg">내 제보 ({reports.length})</h2>
        {reports.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-4 py-5 text-center text-xs text-fg-muted">
            아직 보낸 제보 없음
          </p>
        ) : (
          <ol className="space-y-4">
            {reports.map((r) => {
              const meta: ReportMeta = {
                id: r.id,
                message: r.message,
                created_at: r.created_at,
                category: r.category,
                author: r.author,
              };
              const comments: CommentEntry[] = r.comments.map((c) => ({
                id: c.id,
                author_id: c.author_id,
                body: c.body,
                created_at: c.created_at,
                author: c.author
                  ? { id: c.author.id, name: c.author.name, role: c.author.role }
                  : null,
              }));
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-surface p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
                    <span className="rounded bg-fg/10 px-1.5 py-0.5 font-medium text-fg">
                      {CATEGORY_LABEL[r.category]}
                    </span>
                    <span>·</span>
                    <span>{formatRelativeTime(new Date(r.created_at))}</span>
                    <span
                      className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  <ReportThread
                    report={meta}
                    comments={comments}
                    currentUserId={user.id}
                    isAdmin={false}
                    status={r.status}
                  />
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
