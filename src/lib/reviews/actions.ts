'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';
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
  // 다른 commit 에 대한 답글 (D40). NULL = root commit.
  parentReviewId?: string | null;
}

export async function createReview(input: CreateReviewInput): Promise<CreateReviewResult> {
  const message = input.message.trim();
  if (!message) return { ok: false, message: '내용을 입력해주세요' };
  if (message.length > MAX_MESSAGE) {
    return { ok: false, message: `${MAX_MESSAGE}자 이내로 줄여주세요` };
  }
  if (input.mealTime !== 'lunch' && input.mealTime !== 'dinner') {
    return { ok: false, message: '잘못된 meal_time이에요' };
  }
  if (
    input.partySize !== null &&
    (!Number.isInteger(input.partySize) || input.partySize < 1 || input.partySize > 99)
  ) {
    return { ok: false, message: '인원수는 1~99 사이여야 해요' };
  }
  if (!/^[0-9a-f]{6}$/.test(input.hash)) {
    return { ok: false, message: '잘못된 hash 예요' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  // parent 검증: 같은 식당의 root commit 이어야 (1-level 강제)
  let parentId: string | null = null;
  if (input.parentReviewId) {
    const { data: parent } = await supabase
      .from('reviews')
      .select('id, restaurant_id, parent_review_id')
      .eq('id', input.parentReviewId)
      .maybeSingle();
    if (!parent) return { ok: false, message: '부모 commit 을 찾을 수 없어요' };
    if (parent.restaurant_id !== input.restaurantId) {
      return { ok: false, message: '같은 식당 안에서만 답글이 가능해요' };
    }
    if (parent.parent_review_id) {
      return { ok: false, message: '답글의 답글은 안 돼요 (1-level 까지만)' };
    }
    parentId = parent.id;
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      restaurant_id: input.restaurantId,
      author_id: user.id,
      message,
      meal_time: input.mealTime,
      party_size: input.partySize,
      hash: input.hash,
      parent_review_id: parentId,
    })
    .select('id')
    .single();

  if (error) return { ok: false, message: error.message };
  // commit_count / last_commit_at 트리거가 갱신 → 식당 캐시 무효화
  invalidateRestaurantsCache();
  return { ok: true, id: data.id };
}

// admin 만. RLS 도 admin 만 통과.
export async function deleteReview(id: string): Promise<DeleteReviewResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) return { ok: false, message: error.message };
  invalidateRestaurantsCache();
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
  invalidateRestaurantsCache();
  return { ok: true };
}

export type SetReviewMealTimeResult =
  | { ok: true }
  | { ok: false; message: string };

// admin 만 (RLS 의 update 정책이 admin 우회 허용). 작성자가 잘못 찍은 점심/저녁을 admin 이 보정.
export async function setReviewMealTime(
  id: string,
  mealTime: 'lunch' | 'dinner',
): Promise<SetReviewMealTimeResult> {
  if (mealTime !== 'lunch' && mealTime !== 'dinner') {
    return { ok: false, message: '잘못된 meal_time이에요' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('reviews')
    .update({ meal_time: mealTime })
    .eq('id', id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
