// D78 보강: /log activity feed 용 PR 이벤트 fetch.
// 각 PR 은 최대 2개 이벤트 생성: 'open' (created_at) + 'resolved' (reviewed_at if processed)

import type { SupabaseClient } from '@supabase/supabase-js';

export type LogPREvent = {
  kind: 'pr';
  id: string; // unique key: pr_id + '_open' or pr_id + '_resolved'
  event: 'open' | 'merged' | 'closed';
  pr_id: string;
  source_name: string;
  source_id: string | null;
  target_name: string;
  target_id: string | null;
  actor: {
    name: string;
    avatar_color: string;
    avatar_emoji: string | null;
  } | null;
  reason: string | null;
  at: string;
};

const PR_FETCH_LIMIT = 40;

export async function fetchRecentPullRequestEvents(
  supabase: SupabaseClient,
): Promise<LogPREvent[]> {
  const { data } = await supabase
    .from('pull_requests')
    .select(
      'id, source_id, target_id, status, reason, created_at, reviewed_at, ' +
        'source:restaurants!pull_requests_source_id_fkey ( id, name ), ' +
        'target:restaurants!pull_requests_target_id_fkey ( id, name ), ' +
        'opener:users!pull_requests_opened_by_fkey ( name, avatar_color, avatar_emoji ), ' +
        'reviewer:users!pull_requests_reviewed_by_fkey ( name, avatar_color, avatar_emoji )',
    )
    .order('created_at', { ascending: false })
    .limit(PR_FETCH_LIMIT);

  type Raw = {
    id: string;
    source_id: string;
    target_id: string;
    status: 'open' | 'merged' | 'closed';
    reason: string | null;
    created_at: string;
    reviewed_at: string | null;
    source: { id: string; name: string } | null;
    target: { id: string; name: string } | null;
    opener: { name: string; avatar_color: string; avatar_emoji: string | null } | null;
    reviewer: { name: string; avatar_color: string; avatar_emoji: string | null } | null;
  };

  const events: LogPREvent[] = [];
  for (const pr of ((data ?? []) as unknown as Raw[])) {
    const baseShape = {
      kind: 'pr' as const,
      pr_id: pr.id,
      source_name: pr.source?.name ?? '(삭제됨)',
      source_id: pr.source?.id ?? null,
      target_name: pr.target?.name ?? '(삭제됨)',
      target_id: pr.target?.id ?? null,
      reason: pr.reason,
    };

    // open 이벤트
    events.push({
      ...baseShape,
      id: `${pr.id}_open`,
      event: 'open',
      actor: pr.opener,
      at: pr.created_at,
    });

    // resolved 이벤트
    if (pr.status !== 'open' && pr.reviewed_at) {
      events.push({
        ...baseShape,
        id: `${pr.id}_resolved`,
        event: pr.status,
        actor: pr.reviewer,
        at: pr.reviewed_at,
      });
    }
  }
  return events;
}
