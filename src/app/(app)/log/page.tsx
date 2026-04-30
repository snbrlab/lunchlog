import { createSupabaseServerClient } from '@/lib/supabase/server';
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
    name: string;
    avatar_emoji: string | null;
    avatar_color: string;
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

  const { data } = await supabase
    .from('reviews')
    .select(
      'id, message, meal_time, party_size, hash, reverted, parent_review_id, created_at, ' +
        'author:users!reviews_author_id_fkey ( name, avatar_emoji, avatar_color ), ' +
        'restaurant:restaurants ( id, name, cuisine_types, is_closed ), ' +
        'parent:reviews!reviews_parent_review_id_fkey ( hash, author:users!reviews_author_id_fkey ( name ) )',
    )
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">📜 최근 commit log</h1>
      <p className="mt-1 text-xs text-fg-muted">
        최근 {RECENT_LIMIT}건. 동료들이 어디 가고 있는지 한 눈에.
      </p>
      <div className="mt-5">
        <LogList rows={(data ?? []) as unknown as LogReviewRow[]} />
      </div>
    </main>
  );
}
