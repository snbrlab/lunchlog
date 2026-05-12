'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { invalidateCuisineItemsCache } from '@/lib/cache/cuisine-items';
import { CUISINE_GROUP_META } from '@/lib/cuisine';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') throw new Error('관리자만 가능해요');
  return { supabase, userId: user.id };
}

const VALID_GROUPS = new Set(CUISINE_GROUP_META.map((g) => g.label));

export type CuisineActionResult = { ok: true } | { ok: false; message: string };

export async function createCuisineItem(input: {
  group_label: string;
  value: string;
  label: string | null;
  emoji: string | null;
}): Promise<CuisineActionResult> {
  const value = input.value.trim();
  const label = input.label?.trim() || null;
  const emoji = input.emoji?.trim() || null;

  if (!value) return { ok: false, message: 'value 는 비울 수 없어요' };
  if (value.length > 30) return { ok: false, message: 'value 는 30자 이내' };
  if (label && label.length > 30) return { ok: false, message: 'label 은 30자 이내' };
  if (emoji && emoji.length > 8) return { ok: false, message: 'emoji 는 한 글자 권장' };
  if (!VALID_GROUPS.has(input.group_label)) {
    return { ok: false, message: `잘못된 group_label: ${input.group_label}` };
  }

  const { supabase } = await requireAdmin();

  // display_order — 같은 그룹에서 가장 큰 값 + 1 (기타 항목 99 빼고)
  const { data: existing } = await supabase
    .from('cuisine_items')
    .select('display_order')
    .eq('group_label', input.group_label)
    .lt('display_order', 99)
    .order('display_order', { ascending: false })
    .limit(1);
  const nextOrder = ((existing?.[0]?.display_order as number | undefined) ?? 0) + 1;

  const { error } = await supabase.from('cuisine_items').insert({
    group_label: input.group_label,
    value,
    label,
    emoji,
    display_order: nextOrder,
  });

  if (error) {
    if (error.code === '23505') return { ok: false, message: `이미 존재하는 value: "${value}"` };
    return { ok: false, message: error.message };
  }
  invalidateCuisineItemsCache();
  return { ok: true };
}

// value 는 immutable (기존 식당 데이터 무결성). label / emoji / group_label / display_order 만 변경 가능.
export async function updateCuisineItem(
  value: string,
  patch: {
    label?: string | null;
    emoji?: string | null;
    group_label?: string;
    display_order?: number;
  },
): Promise<CuisineActionResult> {
  if (!value) return { ok: false, message: 'value 가 필요해요' };
  if (patch.group_label && !VALID_GROUPS.has(patch.group_label)) {
    return { ok: false, message: `잘못된 group_label: ${patch.group_label}` };
  }
  if (patch.label != null && patch.label !== null && patch.label.length > 30) {
    return { ok: false, message: 'label 은 30자 이내' };
  }
  if (patch.emoji != null && patch.emoji !== null && patch.emoji.length > 8) {
    return { ok: false, message: 'emoji 는 한 글자 권장' };
  }

  const { supabase } = await requireAdmin();
  const update: Record<string, unknown> = {};
  if (patch.label !== undefined) update.label = patch.label?.trim() || null;
  if (patch.emoji !== undefined) update.emoji = patch.emoji?.trim() || null;
  if (patch.group_label !== undefined) update.group_label = patch.group_label;
  if (patch.display_order !== undefined) update.display_order = patch.display_order;

  const { error } = await supabase.from('cuisine_items').update(update).eq('value', value);
  if (error) return { ok: false, message: error.message };
  invalidateCuisineItemsCache();
  return { ok: true };
}

export async function deleteCuisineItem(value: string): Promise<CuisineActionResult> {
  if (!value) return { ok: false, message: 'value 가 필요해요' };
  const { supabase } = await requireAdmin();

  // 사용 중인지 확인 — restaurants.cuisine_types 배열에 포함된 게 하나라도 있으면 거부.
  // Postgres 배열 contains: cs.{value}
  const { count } = await supabase
    .from('restaurants')
    .select('id', { count: 'exact', head: true })
    .contains('cuisine_types', [value]);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      message: `${count}개 식당이 이 카테고리를 사용 중이에요. 먼저 해당 식당들의 카테고리를 변경하세요.`,
    };
  }

  const { error } = await supabase.from('cuisine_items').delete().eq('value', value);
  if (error) return { ok: false, message: error.message };
  invalidateCuisineItemsCache();
  return { ok: true };
}
