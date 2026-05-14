import { createSupabaseServerClient } from '@/lib/supabase/server';
import ReviewsTable from './ReviewsTable';

export interface AdminReviewRow {
  id: string;
  message: string;
  meal_time: 'lunch' | 'dinner';
  party_size: number | null;
  hash: string;
  reverted: boolean;
  created_at: string;
  author: { name: string; avatar_emoji: string | null; avatar_color: string } | null;
  restaurant: { id: string; name: string; is_closed: boolean } | null;
}

const PAGE_SIZE = 50;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // count + 페이지 fetch — count: 'exact' 하면 total 도 같이 받아옴.
  const [{ data: rows, count: totalCount }, { count: weekCount }, { data: monthAuthors }] =
    await Promise.all([
      supabase
        .from('reviews')
        .select(
          'id, message, meal_time, party_size, hash, reverted, created_at, ' +
            'author:users!reviews_author_id_fkey ( name, avatar_emoji, avatar_color ), ' +
            'restaurant:restaurants ( id, name, is_closed )',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1),
      supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo),
      supabase.from('reviews').select('author_id').gte('created_at', thirtyDaysAgo),
    ]);

  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const distinctAuthors30d = new Set((monthAuthors ?? []).map((r) => r.author_id)).size;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">리뷰 모아보기</h1>
      <p className="mb-6 text-xs text-fg-muted">
        총 {total.toLocaleString('ko-KR')}건 · 페이지당 {PAGE_SIZE}건 · 검색/필터는 현재 페이지에 적용돼요.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Stat label="총 리뷰" value={total} />
        <Stat label="최근 7일" value={weekCount ?? 0} />
        <Stat label="최근 30일 작성자" value={distinctAuthors30d} suffix="명" />
      </div>

      <ReviewsTable
        rows={(rows ?? []) as unknown as AdminReviewRow[]}
        currentPage={pageNum}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        totalCount={total}
      />
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-fg">
        {value.toLocaleString('ko-KR')}
        {suffix && <span className="ml-1 text-base text-fg-muted">{suffix}</span>}
      </div>
    </div>
  );
}
