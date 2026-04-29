'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MealMode } from '@/types/db';

export type CreateReviewResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export type DeleteReviewResult =
  | { ok: true }
  | { ok: false; message: string };

const MAX_MESSAGE = 200;

interface CreateReviewInput {
  restaurantId: string;
  message: string;
  mealTime: MealMode;
  partySize: number | null;
  hash: string;
}

export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, message: '내용을 입력해줘' };
  if (message.length > MAX_MESSAGE) {
    return { ok: false, message: `${MAX_MESSAGE}자 이내로 줄여줘` };
  }
  if (input.mealTime !== 'lunch' && input.mealTime !== 'dinner') {
    return { ok: false, message: '잘못된 meal_time' };
  }
  if (
    input.partySize !== null &&
    (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 99)
  ) {
    return { ok: false, message: '인원수는 1~99 사이' };
  }
  if (!/^[0-9a-f]{6}$/.test(input.hash)) {
    return { ok: false, message: '잘못된 hash' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해' };

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      restaurant_id: input.restaurantId,
      author_id: user.id,
      message,
      meal_time: input.mealTime,
      party_size: input.partySize,
      hash: input.hash,
    })
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, id: data.id };
}

// admin 만. RLS 도 admin 만 통과.
export async function deleteReview(id: string): Promise<DeleteReviewResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type RevertReviewResult =
  | { ok: true }
  | { ok: false; message: string };

// 본인 24h 내 글을 revert 처리 (DB 행 보존, 표시만 strikethrough). RLS 의 update 정책이 검증.
export async function revertReview(id: string): Promise<RevertReviewResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('reviews')
    .update({ reverted: true })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
