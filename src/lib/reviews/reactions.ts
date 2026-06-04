'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// D79: review reactions — 화이트리스트 6개. DB check 와 일치 유지.
export const REACTION_EMOJIS = ['❤️', '🤤', '🔥', '😋', '👀', '💯'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ToggleReactionResult =
  | { ok: true; action: 'added' | 'removed' }
  | { ok: false; message: string };

export async function toggleReaction(
  reviewId: string,
  emoji: string,
): Promise<ToggleReactionResult> {
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return { ok: false, message: '허용되지 않은 이모지예요' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  // 이미 있으면 삭제 (토글). 없으면 insert.
  const { data: existing } = await supabase
    .from('review_reactions')
    .select('review_id')
    .eq('review_id', reviewId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('review_reactions')
      .delete()
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);
    if (error) return { ok: false, message: error.message };
    return { ok: true, action: 'removed' };
  } else {
    const { error } = await supabase.from('review_reactions').insert({
      review_id: reviewId,
      user_id: user.id,
      emoji,
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, action: 'added' };
  }
}
