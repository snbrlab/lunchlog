'use server';

// D78: PR (식당 중복 병합 제안) server actions.
// - createPullRequest: 누구나 (로그인 필수)
// - mergePullRequest / closePullRequest: admin 만

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-admin';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';

export type CreatePRResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function createPullRequest(input: {
  sourceId: string;
  targetId: string;
  reason: string | null;
}): Promise<CreatePRResult> {
  if (input.sourceId === input.targetId) {
    return { ok: false, message: 'source 와 target 이 같아요' };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  // 같은 source/target 의 open PR 이 이미 있으면 중복 방지
  const { data: existing } = await supabase
    .from('pull_requests')
    .select('id')
    .eq('source_id', input.sourceId)
    .eq('target_id', input.targetId)
    .eq('status', 'open')
    .maybeSingle();
  if (existing) {
    return { ok: false, message: '이미 동일한 PR 이 열려있어요' };
  }

  const { data, error } = await supabase
    .from('pull_requests')
    .insert({
      source_id: input.sourceId,
      target_id: input.targetId,
      opened_by: user.id,
      reason: input.reason?.trim() || null,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, message: error?.message ?? '제출 실패' };
  }
  return { ok: true, id: data.id };
}

export type ResolvePRResult =
  | { ok: true }
  | { ok: false; message: string };

export async function mergePullRequest(prId: string): Promise<ResolvePRResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  // PR row 가져오기
  const { data: pr, error: prErr } = await admin.supabase
    .from('pull_requests')
    .select('id, source_id, target_id, status')
    .eq('id', prId)
    .single();
  if (prErr || !pr) return { ok: false, message: prErr?.message ?? 'PR 없음' };
  if (pr.status !== 'open') return { ok: false, message: '이미 처리된 PR 입니다' };

  // 1) merge 실행
  const { error: mergeErr } = await admin.supabase.rpc('merge_restaurants', {
    p_source: pr.source_id,
    p_target: pr.target_id,
  });
  if (mergeErr) return { ok: false, message: mergeErr.message };

  // 2) PR status 갱신 → 트리거가 작성자에게 노티
  const { error: updErr } = await admin.supabase
    .from('pull_requests')
    .update({
      status: 'merged',
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', prId);
  if (updErr) return { ok: false, message: updErr.message };

  invalidateRestaurantsCache();
  return { ok: true };
}

export async function closePullRequest(prId: string): Promise<ResolvePRResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const { error } = await admin.supabase
    .from('pull_requests')
    .update({
      status: 'closed',
      reviewed_by: admin.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', prId)
    .eq('status', 'open');
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
