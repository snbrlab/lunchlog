// issue 목록/상세/피드 fetch.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IssueAuthor {
  name: string;
  avatar_color: string;
  avatar_emoji: string | null;
}

export interface IssueListItem {
  id: string;
  issue_number: number;
  body: string;
  status: 'open' | 'closed';
  office_id: string | null;
  office_name: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  // 미등록 식당 (카카오맵 링크로 지정)
  external_name: string | null;
  external_url: string | null;
  resolved_restaurant_id: string | null;
  resolved_restaurant_name: string | null;
  author: IssueAuthor | null;
  comment_count: number;
  created_at: string;
  closed_at: string | null;
}

export interface IssueComment {
  id: string;
  body: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  author: (IssueAuthor & { id: string }) | null;
  created_at: string;
}

export interface IssueDetail extends IssueListItem {
  author_id: string;
  comments: IssueComment[];
}

const LIST_SELECT =
  'id, issue_number, body, status, office_id, restaurant_id, external_name, external_url, resolved_restaurant_id, created_at, closed_at, ' +
  'author:users!issues_author_id_fkey ( name, avatar_color, avatar_emoji ), ' +
  'restaurant:restaurants!issues_restaurant_id_fkey ( name ), ' +
  'resolved:restaurants!issues_resolved_restaurant_id_fkey ( name ), ' +
  'office:offices ( name ), ' +
  'comments:issue_comments ( count )';

type RawList = {
  id: string;
  issue_number: number;
  body: string;
  status: 'open' | 'closed';
  office_id: string | null;
  restaurant_id: string | null;
  external_name: string | null;
  external_url: string | null;
  resolved_restaurant_id: string | null;
  created_at: string;
  closed_at: string | null;
  author: IssueAuthor | null;
  restaurant: { name: string } | null;
  resolved: { name: string } | null;
  office: { name: string } | null;
  comments: { count: number }[] | { count: number } | null;
};

function shapeList(r: RawList): IssueListItem {
  const cc = Array.isArray(r.comments) ? (r.comments[0]?.count ?? 0) : (r.comments?.count ?? 0);
  return {
    id: r.id,
    issue_number: r.issue_number,
    body: r.body,
    status: r.status,
    office_id: r.office_id,
    office_name: r.office?.name ?? null,
    restaurant_id: r.restaurant_id,
    restaurant_name: r.restaurant?.name ?? null,
    external_name: r.external_name,
    external_url: r.external_url,
    resolved_restaurant_id: r.resolved_restaurant_id,
    resolved_restaurant_name: r.resolved?.name ?? null,
    author: r.author,
    comment_count: cc,
    created_at: r.created_at,
    closed_at: r.closed_at,
  };
}

// 목록 — status: 'open' | 'closed' | 'all', office: 'all' | 'none' | uuid
export async function fetchIssues(
  supabase: SupabaseClient,
  opts: { status?: 'open' | 'closed' | 'all'; office?: string } = {},
): Promise<IssueListItem[]> {
  const status = opts.status ?? 'open';
  const office = opts.office ?? 'all';
  let q = supabase.from('issues').select(LIST_SELECT).order('created_at', { ascending: false }).limit(100);
  if (status !== 'all') q = q.eq('status', status);
  if (office === 'none') q = q.is('office_id', null);
  else if (office !== 'all') q = q.eq('office_id', office);
  const { data } = await q;
  return ((data ?? []) as unknown as RawList[]).map(shapeList);
}

export async function fetchIssueDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<IssueDetail | null> {
  const { data } = await supabase
    .from('issues')
    .select(LIST_SELECT + ', author_id')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;
  const raw = data as unknown as RawList & { author_id: string };
  const base = shapeList(raw);

  const { data: rawComments } = await supabase
    .from('issue_comments')
    .select(
      'id, body, restaurant_id, created_at, ' +
        'author:users!issue_comments_author_id_fkey ( id, name, avatar_color, avatar_emoji ), ' +
        'restaurant:restaurants!issue_comments_restaurant_id_fkey ( name )',
    )
    .eq('issue_id', id)
    .order('created_at', { ascending: true });

  type RawC = {
    id: string;
    body: string;
    restaurant_id: string | null;
    created_at: string;
    author: (IssueAuthor & { id: string }) | null;
    restaurant: { name: string } | null;
  };
  const comments: IssueComment[] = ((rawComments ?? []) as unknown as RawC[]).map((c) => ({
    id: c.id,
    body: c.body,
    restaurant_id: c.restaurant_id,
    restaurant_name: c.restaurant?.name ?? null,
    author: c.author,
    created_at: c.created_at,
  }));

  return { ...base, author_id: raw.author_id, comments };
}

// /log 활동 피드용 — 최근 열린 이슈
export interface LogIssueEvent {
  kind: 'issue';
  id: string;
  issue_id: string;
  issue_number: number;
  body: string;
  office_id: string | null;
  restaurant_name: string | null;
  author: IssueAuthor | null;
  at: string;
}

export async function fetchRecentIssueEvents(
  supabase: SupabaseClient,
): Promise<LogIssueEvent[]> {
  const { data } = await supabase
    .from('issues')
    .select(
      'id, issue_number, body, office_id, external_name, created_at, ' +
        'author:users!issues_author_id_fkey ( name, avatar_color, avatar_emoji ), ' +
        'restaurant:restaurants!issues_restaurant_id_fkey ( name )',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  type Raw = {
    id: string;
    issue_number: number;
    body: string;
    office_id: string | null;
    external_name: string | null;
    created_at: string;
    author: IssueAuthor | null;
    restaurant: { name: string } | null;
  };
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    kind: 'issue' as const,
    id: `${r.id}_opened`,
    issue_id: r.id,
    issue_number: r.issue_number,
    body: r.body,
    office_id: r.office_id,
    restaurant_name: r.restaurant?.name ?? r.external_name ?? null,
    author: r.author,
    at: r.created_at,
  }));
}
