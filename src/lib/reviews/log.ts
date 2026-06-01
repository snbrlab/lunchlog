// D64: /log commit 로그 — 페이지네이션 + 캐싱 공통 로직.
// keyset(cursor) 페이지네이션 — created_at 기준. offset 보다 새 행 삽입에 안정적.

import type { SupabaseClient } from '@supabase/supabase-js';

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
    primary_badge_code: string | null;
  } | null;
  restaurant: {
    id: string;
    name: string;
    cuisine_types: string[];
    is_closed: boolean;
    office_id: string | null;
  } | null;
  // 답글일 때 부모 commit 의 hash + 작성자 (별도 select)
  parent: { hash: string; author: { name: string } | null } | null;
}

export const LOG_PAGE_SIZE = 100;

// before: 이 시각보다 과거의 commit 만 (keyset cursor). 없으면 최신부터.
export async function fetchReviewLogPage(
  supabase: SupabaseClient,
  opts: { before?: string; limit?: number } = {},
): Promise<LogReviewRow[]> {
  const limit = opts.limit ?? LOG_PAGE_SIZE;

  let q = supabase
    .from('reviews')
    .select(
      'id, message, meal_time, party_size, hash, reverted, parent_review_id, created_at, ' +
        'author:users!reviews_author_id_fkey ( id, name, avatar_emoji, avatar_color, office_id, primary_badge_code ), ' +
        'restaurant:restaurants ( id, name, cuisine_types, is_closed, office_id )',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts.before) q = q.lt('created_at', opts.before);

  const { data: rawData } = await q;
  type RawRow = Omit<LogReviewRow, 'parent'>;
  const baseRows = (rawData ?? []) as unknown as RawRow[];

  // parent 정보 batched fetch (self-referential FK 임베드 회피)
  const parentIds = Array.from(
    new Set(baseRows.map((r) => r.parent_review_id).filter((x): x is string => !!x)),
  );
  type ParentRow = { id: string; hash: string; author: { name: string } | null };
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

  return baseRows.map((r) => ({
    ...r,
    parent: r.parent_review_id
      ? (parentMap.get(r.parent_review_id) ?? null) && {
          hash: parentMap.get(r.parent_review_id)!.hash,
          author: parentMap.get(r.parent_review_id)!.author,
        }
      : null,
  }));
}
