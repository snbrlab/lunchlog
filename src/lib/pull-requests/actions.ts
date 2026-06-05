'use server';

// D78/D80: PR (식당 중복 병합 + 정보 수정 제안) server actions.
// - createPullRequest: 누구나 (로그인 필수) — merge 또는 edit kind
// - mergePullRequest / applyEditPullRequest / closePullRequest: admin 만

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';
import { requireAdmin } from '@/lib/auth/require-admin';
import { EDIT_FIELDS } from '@/lib/pull-requests/fields';
import type { EditField, EditPayload } from '@/types/db';

const ALLOWED_EDIT_FIELDS: Set<EditField> = new Set(EDIT_FIELDS);

export type CreatePRResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type CreatePRInput =
  | {
      kind: 'merge';
      sourceId: string;
      targetId: string;
      reason: string | null;
    }
  | {
      kind: 'edit';
      targetId: string;
      editPayload: EditPayload;
      reason: string | null;
    };

export async function createPullRequest(input: CreatePRInput): Promise<CreatePRResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  if (input.kind === 'merge') {
    if (input.sourceId === input.targetId) {
      return { ok: false, message: 'source 와 target 이 같아요' };
    }
    const { data: existing } = await supabase
      .from('pull_requests')
      .select('id')
      .eq('source_id', input.sourceId)
      .eq('target_id', input.targetId)
      .eq('kind', 'merge')
      .eq('status', 'open')
      .maybeSingle();
    if (existing) return { ok: false, message: '이미 동일한 병합 PR 이 열려있어요' };

    const { data, error } = await supabase
      .from('pull_requests')
      .insert({
        kind: 'merge',
        source_id: input.sourceId,
        target_id: input.targetId,
        opened_by: user.id,
        reason: input.reason?.trim() || null,
      })
      .select('id')
      .single();
    if (error || !data) return { ok: false, message: error?.message ?? '제출 실패' };
    return { ok: true, id: data.id };
  }

  // edit PR
  const { data, error } = await supabase
    .from('pull_requests')
    .insert({
      kind: 'edit',
      source_id: null,
      target_id: input.targetId,
      opened_by: user.id,
      reason: input.reason?.trim() || null,
      edit_payload: input.editPayload,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? '제출 실패' };
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
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', prId);
  if (updErr) return { ok: false, message: updErr.message };

  invalidateRestaurantsCache();
  return { ok: true };
}

// D80: edit PR 적용 — payload 의 field/new 값을 restaurants 에 UPDATE.
export async function applyEditPullRequest(prId: string): Promise<ResolvePRResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { data: pr, error: prErr } = await admin.supabase
    .from('pull_requests')
    .select('id, kind, target_id, status, edit_payload')
    .eq('id', prId)
    .single();
  if (prErr || !pr) return { ok: false, message: prErr?.message ?? 'PR 없음' };
  if (pr.status !== 'open') return { ok: false, message: '이미 처리된 PR 입니다' };
  if (pr.kind !== 'edit') return { ok: false, message: 'edit PR 이 아니에요' };
  if (!pr.target_id) return { ok: false, message: '대상 식당이 없어요 (삭제됨)' };
  const payload = pr.edit_payload as EditPayload | null;
  if (!payload) return { ok: false, message: 'edit_payload 가 비어있어요' };

  // 허용된 field 만 update — SQL injection / 임의 컬럼 변경 방지
  if (!ALLOWED_EDIT_FIELDS.has(payload.field)) {
    return { ok: false, message: `허용되지 않은 field: ${payload.field}` };
  }

  const { error: updErr } = await admin.supabase
    .from('restaurants')
    .update({ [payload.field]: payload.new })
    .eq('id', pr.target_id);
  if (updErr) return { ok: false, message: updErr.message };

  const { error: prUpdErr } = await admin.supabase
    .from('pull_requests')
    .update({
      status: 'merged',
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', prId);
  if (prUpdErr) return { ok: false, message: prUpdErr.message };

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
      reviewed_by: admin.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', prId)
    .eq('status', 'open');
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
