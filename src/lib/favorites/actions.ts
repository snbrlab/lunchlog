'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ToggleFavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; message: string };

// 찜 토글 — 이미 찜한 식당이면 해제, 아니면 추가.
export async function toggleFavorite(restaurantId: string): Promise<ToggleFavoriteResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const { data: existing } = await supabase
    .from('favorites')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('restaurant_id', restaurantId);
    if (error) return { ok: false, message: error.message };
    return { ok: true, favorited: false };
  }

  const { error } = await supabase
    .from('favorites')
    .insert({ user_id: user.id, restaurant_id: restaurantId });
  if (error) return { ok: false, message: error.message };
  return { ok: true, favorited: true };
}
