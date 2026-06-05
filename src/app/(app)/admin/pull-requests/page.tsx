// D78: PR 처리 페이지 — 사용자가 연 식당 중복 병합 제안을 admin 이 검토/실행/거부.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PRAdminList } from './PRAdminList';

import type { EditPayload } from '@/types/db';

export interface AdminPRRow {
  id: string;
  kind: 'merge' | 'edit';
  source_id: string | null;
  target_id: string | null;
  opened_by: string;
  reason: string | null;
  edit_payload: EditPayload | null;
  status: 'open' | 'merged' | 'closed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  source: { id: string; name: string; commit_count: number; is_closed: boolean } | null;
  target: { id: string; name: string; commit_count: number; is_closed: boolean } | null;
  opener: { name: string } | null;
  reviewer: { name: string } | null;
}

export default async function AdminPullRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('pull_requests')
    .select(
      'id, kind, source_id, target_id, opened_by, reason, edit_payload, status, reviewed_by, reviewed_at, created_at, ' +
        'source:restaurants!pull_requests_source_id_fkey ( id, name, commit_count, is_closed ), ' +
        'target:restaurants!pull_requests_target_id_fkey ( id, name, commit_count, is_closed ), ' +
        'opener:users!pull_requests_opened_by_fkey ( name ), ' +
        'reviewer:users!pull_requests_reviewed_by_fkey ( name )',
    )
    .order('status', { ascending: true }) // open 먼저
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">🔀 Pull Requests</h1>
      <p className="mb-6 text-xs text-fg-muted">
        사용자가 제안한 식당 중복 병합. merge 시 source 의 리뷰/찜이 target 으로 이전되고
        source 는 삭제됩니다.
      </p>
      <PRAdminList rows={(data ?? []) as unknown as AdminPRRow[]} />
    </main>
  );
}
