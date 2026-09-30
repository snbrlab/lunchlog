'use server';

// 카드사 이벤트 개인 사용 기록 (월 3회 캐시백 — "어디서 썼는지" 본인 기억용).
// 카드사 시스템과 연동 불가이므로 순수 자기신고. 강제 차단 없음, 4번째부터는 UI 경고만.

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type UsageActionResult = { ok: true } | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function logCardEventUsage(
  merchantId: string,
  usedAt: string,
  amount: number | null,
): Promise<UsageActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  if (!DATE_RE.test(usedAt)) return { ok: false, message: '날짜 형식이 올바르지 않아요' };
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return { ok: false, message: '금액이 올바르지 않아요' };
  }

  const { error } = await supabase.from('card_event_usage').insert({
    user_id: user.id,
    merchant_id: merchantId,
    used_at: usedAt,
    amount,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteCardEventUsage(usageId: string): Promise<UsageActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  // RLS 도 user_id = auth.uid() 로 막지만, 명시적으로도 한 번 더 조건.
  const { error } = await supabase
    .from('card_event_usage')
    .delete()
    .eq('id', usageId)
    .eq('user_id', user.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
