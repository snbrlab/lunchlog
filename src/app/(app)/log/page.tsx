import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedOffices } from '@/lib/cache/offices';
import LogList from './LogList';

export interface LogReviewRow {
  id: string;
  message: string;
  meal_time: 'lunch' | 'dinner';
  party_size: number | null;
  hash: string;
  reverted: boolean;
  parent_review_id: string | null;
  created_at: string;
  author: {
    id: string;
    name: string;
    avatar_emoji: string | null;
    avatar_color: string;
    office_id: string | null;
  } | null;
  restaurant: {
    id: string;
    name: string;
    cuisine_types: string[];
    is_closed: boolean;
  } | null;
  // 답글일 때 부모 commit 의 hash + 작성자 (별도 select)
  parent: { hash: string; author: { name: string } | null } | null;
}

const RECENT_LIMIT = 100;

// 사내 commit log. /log — 모든 사용자가 최근 활동을 한 화면에 모아봄.
export default async function LogPage() {
  const supabase = await createSupabaseServerClient();

  // 1) 메인 reviews 조회 (parent 는 별도 fetch — self-referential FK 임베드 회피)
  // author.office_id 까지 같이 가져와서 근무지별 필터링 가능 (D46)
  const [{ data: rawData }, offices] = await Promise.all([
    supabase
      .from('reviews')
      .select(
        'id, message, meal_time, party_size, hash, reverted, parent_review_id, created_at, ' +
          'author:users!reviews_author_id_fkey ( id, name, avatar_emoji, avatar_color, office_id ), ' +
          'restaurant:restaurants ( id, name, cuisine_types, is_closed )',
      )
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    getCachedOffices(),
  ]);

  type RawRow = Omit<LogReviewRow, 'parent'>;
  const baseRows = (rawData ?? []) as unknown as RawRow[];

  // 2) parent 정보 batched fetch
  const parentIds = Array.from(
    new Set(baseRows.map((r) => r.parent_review_id).filter((x): x is string => !!x)),
  );
  type ParentRow = {
    id: string;
    hash: string;
    author: { name: string } | null;
  };
  const parentMap = new Map<string, ParentRow>();
  if (parentIds.length > 0) {
    const { data: parentData } = await supabase
      .from('reviews')
      .select('id, hash, author:users!reviews_author_id_fkey ( name )')
      .in('id', parentIds);
    for (const p of (parentData ?? []) as unknown as ParentRow[]) {
      parentMap.set(p.id, p);
    }
  }

  const rows: LogReviewRow[] = baseRows.map((r) => ({
    ...r,
    parent: r.parent_review_id
      ? (parentMap.get(r.parent_review_id) ?? null) && {
          hash: parentMap.get(r.parent_review_id)!.hash,
          author: parentMap.get(r.parent_review_id)!.author,
        }
      : null,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">📜 최근 commit log</h1>
      <p className="mt-1 text-xs text-fg-muted">
        최근 {RECENT_LIMIT}건. 동료들이 어디 가고 있는지 한 눈에.
      </p>
      <div className="mt-5">
        <LogList rows={rows} offices={offices} />
      </div>
    </main>
  );
}
