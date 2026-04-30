'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/format-time';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import { deleteReview, revertReview, setReviewMealTime } from '@/lib/reviews/actions';
import type { MealMode, Review } from '@/types/db';

type AuthorMeta = {
  id: string;
  name: string;
  avatar_color: string;
  avatar_emoji: string | null;
};

type EnrichedReview = Review & { author: AuthorMeta | null };

const FRESH_DAYS = 7;

interface Props {
  restaurantId: string;
  currentUserId: string;
  isAdmin: boolean;
  // 작성/삭제 후 부모가 increment 해서 강제 refresh 트리거
  refreshKey: number;
  onMutated: () => void;
}

export function ReviewLog({ restaurantId, currentUserId, isAdmin, refreshKey, onMutated }: Props) {
  const { mode } = useMealMode();
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [loading, setLoading] = useState(true);
  // SPEC D8: 기본값은 현재 탭. 모드 토글 시 자동 sync.
  const [filter, setFilter] = useState<'all' | MealMode>(mode);
  useEffect(() => {
    setFilter(mode);
  }, [mode]);
  const [pendingMutateId, setPendingMutateId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // 식당 변경 또는 refreshKey 증가 시 fetch
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id, restaurant_id, author_id, message, meal_time, party_size, hash, reverted, created_at, edited_at, ' +
            'author:users!reviews_author_id_fkey ( id, name, avatar_color, avatar_emoji )',
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('reviews fetch failed:', error.message);
        setReviews([]);
      } else {
        setReviews(
          (data ?? []).map((r) => ({
            ...(r as unknown as Review),
            author: (r as unknown as { author: AuthorMeta | null }).author,
          })),
        );
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, refreshKey]);

  // 필터만 적용. 그룹화/접기 안 함 (D6 보강 — 사용자 의견 따라 다 펼침).
  const groups = useMemo(() => {
    return reviews
      .filter((r) => filter === 'all' || r.meal_time === filter)
      .map((r) => ({ latest: r, older: [] as EnrichedReview[] }));
  }, [reviews, filter]);

  const counts = useMemo(() => {
    const lunch = reviews.filter((r) => r.meal_time === 'lunch').length;
    const dinner = reviews.filter((r) => r.meal_time === 'dinner').length;
    return { lunch, dinner, all: reviews.length };
  }, [reviews]);

  function onDelete(id: string) {
    if (!confirm('이 commit 을 완전히 삭제할까? (관리자 작업)')) return;
    setPendingMutateId(id);
    startTransition(async () => {
      const r = await deleteReview(id);
      setPendingMutateId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      onMutated();
    });
  }

  function onRevert(id: string) {
    if (!confirm('이 commit 을 revert 할까? (취소선만 그어지고 기록은 보존)')) return;
    setPendingMutateId(id);
    startTransition(async () => {
      const r = await revertReview(id);
      setPendingMutateId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      onMutated();
    });
  }

  function onToggleMeal(id: string, current: MealMode) {
    const next: MealMode = current === 'lunch' ? 'dinner' : 'lunch';
    setPendingMutateId(id);
    startTransition(async () => {
      const r = await setReviewMealTime(id, next);
      setPendingMutateId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      onMutated();
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 + 필터 토글 */}
      <div className="flex items-center justify-between border-t border-border px-5 py-2.5 text-[11px]">
        <p className="font-semibold uppercase tracking-wider text-fg-muted">REVIEW LOG</p>
        <div role="tablist" className="flex items-center gap-1">
          {(['lunch', 'dinner', 'all'] as const).map((f) => {
            const active = f === filter;
            const label =
              f === 'lunch'
                ? `☀ 점심 ${counts.lunch}`
                : f === 'dinner'
                ? `☾ 저녁 ${counts.dinner}`
                : `전체 ${counts.all}`;
            return (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f)}
                className={`rounded-full px-2 py-0.5 transition ${
                  active ? 'bg-fg text-bg' : 'bg-bg text-fg-muted hover:bg-fg/5'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 목록 */}
      <ol className="flex-1 overflow-y-auto px-5 pb-2">
        {loading && (
          <li className="py-6 text-center text-xs text-fg-muted/70">불러오는 중…</li>
        )}
        {!loading && groups.length === 0 && (
          <li className="py-6 text-center text-xs text-fg-muted/70">
            아직 commit 이 없네. 첫 한 줄을 남겨줘.
          </li>
        )}
        {groups.map(({ latest, older }) => (
          <ReviewItem
            key={latest.id}
            latest={latest}
            older={older}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            pendingMutateId={pendingMutateId}
            onDelete={onDelete}
            onRevert={onRevert}
            onToggleMeal={onToggleMeal}
          />
        ))}
      </ol>
    </div>
  );
}

function ReviewItem({
  latest,
  older,
  currentUserId,
  isAdmin,
  pendingMutateId,
  onDelete,
  onRevert,
  onToggleMeal,
}: {
  latest: EnrichedReview;
  older: EnrichedReview[];
  currentUserId: string;
  isAdmin: boolean;
  pendingMutateId: string | null;
  onDelete: (id: string) => void;
  onRevert: (id: string) => void;
  onToggleMeal: (id: string, current: MealMode) => void;
}) {
  const [showOlder, setShowOlder] = useState(false);
  const items = showOlder ? [latest, ...older] : [latest];

  return (
    <li>
      <div className="relative pl-4">
        <span className="absolute left-1 top-0 h-full w-px bg-border" aria-hidden />
        {items.map((r, idx) => (
          <ReviewRow
            key={r.id}
            review={r}
            isHead={idx === 0}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            pendingMutate={pendingMutateId === r.id}
            onDelete={() => onDelete(r.id)}
            onRevert={() => onRevert(r.id)}
            onToggleMeal={() => onToggleMeal(r.id, r.meal_time)}
          />
        ))}
        {!showOlder && older.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOlder(true)}
            className="ml-2 mt-0.5 mb-2 block text-[11px] text-fg-muted hover:text-fg"
          >
            ▾ {latest.author?.name ?? '이 사람'}의 이전 commit {older.length}개 더보기
          </button>
        )}
      </div>
    </li>
  );
}

function ReviewRow({
  review,
  isHead,
  currentUserId,
  isAdmin,
  pendingMutate,
  onDelete,
  onRevert,
  onToggleMeal,
}: {
  review: EnrichedReview;
  isHead: boolean;
  currentUserId: string;
  isAdmin: boolean;
  pendingMutate: boolean;
  onDelete: () => void;
  onRevert: () => void;
  onToggleMeal: () => void;
}) {
  const created = new Date(review.created_at);
  const ageDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  const dotColor = ageDays <= FRESH_DAYS ? 'bg-fresh' : 'bg-stale';

  const isMine = review.author_id === currentUserId;
  const canRevert = isMine && !review.reverted;

  const authorName = review.author?.name ?? '(알수없음)';
  const authorEmoji = resolveAvatarEmoji(
    review.author?.avatar_emoji,
    authorName + review.author_id,
  );
  const authorColor = review.author?.avatar_color ?? '#fde68a';

  return (
    <div className={`relative flex gap-2.5 py-2 ${isHead ? '' : 'opacity-90'}`}>
      <span
        aria-hidden
        className={`absolute -left-3 top-3 h-2 w-2 rounded-full ring-2 ring-surface ${dotColor}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span className="font-mono text-fg/80">{review.hash}</span>
          <span>·</span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{ backgroundColor: authorColor }}
            aria-hidden
          >
            {authorEmoji}
          </span>
          <span className="font-medium text-fg">{authorName}</span>
          <span>·</span>
          <span>{formatRelativeTime(created)}</span>
          {isAdmin ? (
            <button
              type="button"
              onClick={onToggleMeal}
              disabled={pendingMutate}
              title={`관리자: ${review.meal_time === 'lunch' ? '점심 → 저녁' : '저녁 → 점심'} 으로 변경`}
              className="rounded px-0.5 hover:bg-fg/10 disabled:opacity-50"
            >
              {review.meal_time === 'lunch' ? '☀' : '☾'}
            </button>
          ) : (
            <span title={review.meal_time === 'lunch' ? '점심' : '저녁'} aria-hidden>
              {review.meal_time === 'lunch' ? '☀' : '☾'}
            </span>
          )}
          {review.party_size != null && (
            <span
              title={`${review.party_size}명이서 방문`}
              aria-label={`방문 인원 ${review.party_size}명`}
            >
              👥{review.party_size}
            </span>
          )}
          {review.reverted && (
            <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-fg-muted">
              REVERTED
            </span>
          )}
          <span className="ml-auto flex items-center gap-2">
            {canRevert && (
              <button
                type="button"
                onClick={onRevert}
                disabled={pendingMutate}
                title="commit 취소 (취소선만 그어지고 기록 보존)"
                className="text-[10px] text-fg-muted hover:text-amber-600 disabled:opacity-50"
              >
                {pendingMutate ? '…' : 'revert'}
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={onDelete}
                disabled={pendingMutate}
                title="관리자: 완전 삭제"
                className="text-[10px] text-fg-muted hover:text-red-500 disabled:opacity-50"
              >
                {pendingMutate ? '…' : 'delete'}
              </button>
            )}
          </span>
        </div>
        <p
          className={`mt-0.5 text-sm ${
            review.reverted ? 'text-fg-muted line-through' : 'text-fg'
          }`}
        >
          {review.message}
        </p>
      </div>
    </div>
  );
}
