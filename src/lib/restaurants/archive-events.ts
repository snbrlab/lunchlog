// /log activity feed 용 아카이브(폐업) 이벤트.
// 폐업 처리 시 restaurants.closed_at 이 찍히고, 그 시각으로 피드에 흐른다.
// 폐업 해제하면 closed_at 이 null 이 되어 이벤트도 자연히 사라짐.

import type { SupabaseClient } from '@supabase/supabase-js';

export type LogArchiveEvent = {
  kind: 'archive';
  id: string; // unique key
  restaurant_id: string;
  restaurant_name: string;
  cuisine_types: string[];
  // /log region 필터용
  office_id: string | null;
  commit_count: number;
  at: string;
};

const ARCHIVE_FETCH_LIMIT = 20;

export async function fetchRecentArchiveEvents(
  supabase: SupabaseClient,
): Promise<LogArchiveEvent[]> {
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types, office_id, commit_count, closed_at')
    .eq('is_closed', true)
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(ARCHIVE_FETCH_LIMIT);

  type Raw = {
    id: string;
    name: string;
    cuisine_types: string[] | null;
    office_id: string | null;
    commit_count: number;
    closed_at: string;
  };

  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    kind: 'archive' as const,
    id: `${r.id}_archived`,
    restaurant_id: r.id,
    restaurant_name: r.name,
    cuisine_types: r.cuisine_types ?? [],
    office_id: r.office_id,
    commit_count: r.commit_count,
    at: r.closed_at,
  }));
}
