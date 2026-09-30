'use server';

// 카드사 이벤트(card_event_merchants) 매칭 검수 — admin 전용.
// - linkCardEventMerchant: 런치로그 식당과 수동 연결(자동매칭 확정 또는 직접 검색해서 연결)
// - unlinkCardEventMerchant: 매칭 없음으로 확정 (검수는 끝났지만 연결할 식당이 없음)
// - setCardEventMerchantExcluded: 업종 필터를 통과했지만 실제로는 식당이 아니거나 지도에 안 보이게
// - setCardEventMerchantCoords: 지오코딩 실패 항목에 좌표 수동 입력(카카오 검색 결과 선택)

import { requireAdmin } from '@/lib/auth/require-admin';

export type CardEventActionResult = { ok: true } | { ok: false; message: string };

export async function linkCardEventMerchant(
  merchantId: string,
  restaurantId: string,
): Promise<CardEventActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { error } = await admin.supabase
    .from('card_event_merchants')
    .update({
      matched_restaurant_id: restaurantId,
      match_confidence: 'auto', // admin 이 직접 확정 = auto 와 동급 신뢰도
      reviewed: true,
    })
    .eq('id', merchantId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function unlinkCardEventMerchant(merchantId: string): Promise<CardEventActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { error } = await admin.supabase
    .from('card_event_merchants')
    .update({
      matched_restaurant_id: null,
      match_confidence: 'none',
      reviewed: true,
    })
    .eq('id', merchantId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function setCardEventMerchantExcluded(
  merchantId: string,
  excluded: boolean,
): Promise<CardEventActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { error } = await admin.supabase
    .from('card_event_merchants')
    .update({ excluded, reviewed: true })
    .eq('id', merchantId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function setCardEventMerchantCoords(
  merchantId: string,
  latitude: number,
  longitude: number,
): Promise<CardEventActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, message: '좌표가 올바르지 않아요' };
  }

  const { error } = await admin.supabase
    .from('card_event_merchants')
    .update({ latitude, longitude, geocode_status: 'ok' })
    .eq('id', merchantId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
