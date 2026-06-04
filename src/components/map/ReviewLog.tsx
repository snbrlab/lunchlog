'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatRelativeTime } from '@/lib/format-time';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { deleteReview, revertReview, setReviewMealTime } from '@/lib/reviews/actions';
import type { MealMode, Review } from '@/types/db';

// D75: @nickname 패턴 chip 렌더. 두 가지 형태 지원 — DB 트리거 / composer 와 동일.
//   1) @[Name with /, space, etc.]  — 특수문자 포함 닉네임용 (Composer 가 자동 wrap)
//   2) @simpleName                  — 영문/숫자/_/한글만 있는 닉네임용 (기존 호환)
function renderMessageWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /@(?:\[([^\]\n]+)\]|([\w가-힣]+))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const name = m[1] ?? m[2] ?? '';
    parts.push(
      <span
        key={`mention-${i++}`}
        className="rounded bg-sky-100 px-1 py-0.5 text-[0.95em] font-medium text-sky-800"
      >
        @{name}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type AuthorMeta = {
  id: string;
  name: string;
  avatar_color: string;
  avatar_emoji: string | null;
};

type EnrichedReview = Review & { author: AuthorMeta | null };

const FRESH_DAYS = 7;

// D55: 모듈 레벨 메모리 캐시. 식당 디테일 패널을 왔다갔다 할 때 매번 fetch 하던 걸 제거.
// - TTL 60s 내 hit → 네트워크 skip, 즉시 표시
// - mutation (refreshKey 증가) → 해당 식당 키 invalidate
// 페이지 리로드 시 자연 소멸 → stale 위험 적음.
const REVIEWS_CACHE = new Map<string, { data: EnrichedReview[]; at: number }>();
const REVIEWS_TTL_MS = 60 * 1000;

interface Props {
  restaurantId: string;
  currentUserId: string;
  isAdmin: boolean;
  // 작성/삭제 후 부모가 increment 해서 강제 refresh 트리거
  refreshKey: number;
  onMutated: () => void;
  // 답글 버튼 클릭 시 부모(DetailPanel)에 알리는 콜백 — D40
  onReply?: (review: { id: string; hash: string; authorName: string }) => void;
}

export function ReviewLog({
  restaurantId,
  currentUserId,
  isAdmin,
  refreshKey,
  onMutated,
  onReply,
}: Props) {
  const [reviews, setReviews] = useState<EnrichedReview[]>([]);
  const [loading, setLoading] = useState(true);
  // 식당 클릭 시점엔 그 식당의 전체 컨텍스트가 더 가치 있음 → 기본 '전체'.
  // (사이드바는 모드 필터 유지 — 식당 결정 단계에서만 모드가 핵심)
  const [filter, setFilter] = useState<'all' | MealMode>('all');
  const [pendingMutateId, setPendingMutateId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // D55: refreshKey 가 증가한 사이클이면 해당 식당의 캐시 무효화 (mutate 후 fresh)
  const lastRefreshKeyRef = useRef(refreshKey);

  // 식당 변경 또는 refreshKey 증가 시 fetch (단, 캐시 hit + fresh 면 skip)
  useEffect(() => {
    let cancelled = false;

    // 1) refreshKey 변동 감지 → 그 시점에 보고 있던 식당 캐시 invalidate
    if (lastRefreshKeyRef.current !== refreshKey) {
      REVIEWS_CACHE.delete(restaurantId);
      lastRefreshKeyRef.current = refreshKey;
    }

    // 2) 캐시 hit + 신선 → 즉시 표시, 네트워크 skip
    const cached = REVIEWS_CACHE.get(restaurantId);
    if (cached && Date.now() - cached.at < REVIEWS_TTL_MS) {
      setReviews(cached.data);
      setLoading(false);
      return;
    }

    // 3) stale 캐시라도 있으면 우선 보여주고 (no flash), 백그라운드에서 새로 받기
    if (cached) {
      setReviews(cached.data);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const supabase = createSupabaseBrowserClient();
    (async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(
          'id, restaurant_id, author_id, message, meal_time, party_size, hash, reverted, parent_review_id, created_at, edited_at, ' +
            'author:users!reviews_author_id_fkey ( id, name, avatar_color, avatar_emoji )',
        )
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error('reviews fetch failed:', error.message);
        setReviews([]);
      } else {
        const items: EnrichedReview[] = (data ?? []).map((r) => ({
          ...(r as unknown as Review),
          author: (r as unknown as { author: AuthorMeta | null }).author,
        }));
        REVIEWS_CACHE.set(restaurantId, { data: items, at: Date.now() });
        setReviews(items);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, refreshKey]);

  // root commit + 그에 달린 branch reply 들로 그룹화 (D40)
  // - root: parent_review_id IS NULL — 시간 역순 (최신 위)
  // - replies: 해당 root 아래에 시간 순 (오래된 게 위)
  // 필터(meal_time)는 root 기준으로 적용 — root 가 통과하면 그 답글도 같이 노출
  const groups = useMemo(() => {
    const childrenByParent = new Map<string, EnrichedReview[]>();
    for (const r of reviews) {
      if (r.parent_review_id) {
        const arr = childrenByParent.get(r.parent_review_id) ?? [];
        arr.push(r);
        childrenByParent.set(r.parent_review_id, arr);
      }
    }
    for (const arr of childrenByParent.values()) {
      arr.sort(
        (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
      );
    }
    return reviews
      .filter((r) => !r.parent_review_id)
      .filter((r) => filter === 'all' || r.meal_time === filter)
      .map((root) => ({
        root,
        replies: childrenByParent.get(root.id) ?? [],
      }));
  }, [reviews, filter]);

  const counts = useMemo(() => {
    const lunch = reviews.filter((r) => r.meal_time === 'lunch').length;
    const dinner = reviews.filter((r) => r.meal_time === 'dinner').length;
    return { lunch, dinner, all: reviews.length };
  }, [reviews]);

  function onDelete(id: string) {
    if (!confirm('이 commit 을 완전히 삭제할까요? (관리자 작업)')) return;
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
    if (!confirm('이 commit 을 revert 할까요? (취소선만 그어지고 기록은 보존)')) return;
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
    <div className="flex flex-col">
      {/* 헤더 + 필터 토글 — 부모 스크롤 영역 안에서 sticky 로 상단 고정. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-t border-border bg-surface px-5 py-2.5 text-[11px]">
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

      {/* 목록 — 자체 스크롤 없음. 부모 스크롤 영역에서 처리. */}
      <ol className="px-5 pb-2">
        {loading && (
          <li className="py-6 text-center text-xs text-fg-muted/70">불러오는 중…</li>
        )}
        {!loading && groups.length === 0 && (
          <li className="py-6 text-center text-xs text-fg-muted/70">
            아직 commit 이 없네요. 첫 한 줄을 남겨주세요.
          </li>
        )}
        {groups.map(({ root, replies }) => (
          <ReviewItem
            key={root.id}
            root={root}
            replies={replies}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            pendingMutateId={pendingMutateId}
            onDelete={onDelete}
            onRevert={onRevert}
            onToggleMeal={onToggleMeal}
            onReply={onReply}
          />
        ))}
      </ol>
    </div>
  );
}

function ReviewItem({
  root,
  replies,
  currentUserId,
  isAdmin,
  pendingMutateId,
  onDelete,
  onRevert,
  onToggleMeal,
  onReply,
}: {
  root: EnrichedReview;
  replies: EnrichedReview[];
  currentUserId: string;
  isAdmin: boolean;
  pendingMutateId: string | null;
  onDelete: (id: string) => void;
  onRevert: (id: string) => void;
  onToggleMeal: (id: string, current: MealMode) => void;
  onReply?: (review: { id: string; hash: string; authorName: string }) => void;
}) {
  return (
    <li>
      <div className="relative pl-4">
        <span className="absolute left-1 top-0 h-full w-px bg-border" aria-hidden />
        <ReviewRow
          review={root}
          isBranch={false}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          pendingMutate={pendingMutateId === root.id}
          onDelete={() => onDelete(root.id)}
          onRevert={() => onRevert(root.id)}
          onToggleMeal={() => onToggleMeal(root.id, root.meal_time)}
          onReply={
            onReply
              ? () =>
                  onReply({
                    id: root.id,
                    hash: root.hash,
                    authorName: root.author?.name ?? '(알수없음)',
                  })
              : undefined
          }
        />
        {replies.map((reply) => (
          <ReviewRow
            key={reply.id}
            review={reply}
            isBranch
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            pendingMutate={pendingMutateId === reply.id}
            onDelete={() => onDelete(reply.id)}
            onRevert={() => onRevert(reply.id)}
            onToggleMeal={() => onToggleMeal(reply.id, reply.meal_time)}
            // 1-level 만 허용 — branch 에는 답글 못 다는 게 정책
            onReply={undefined}
          />
        ))}
      </div>
    </li>
  );
}

function ReviewRow({
  review,
  isBranch,
  currentUserId,
  isAdmin,
  pendingMutate,
  onDelete,
  onRevert,
  onToggleMeal,
  onReply,
}: {
  review: EnrichedReview;
  isBranch: boolean;
  currentUserId: string;
  isAdmin: boolean;
  pendingMutate: boolean;
  onDelete: () => void;
  onRevert: () => void;
  onToggleMeal: () => void;
  onReply?: () => void;
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
    <div className={`relative flex gap-2.5 py-2 ${isBranch ? 'pl-6' : ''}`}>
      {isBranch && (
        <span
          aria-hidden
          className="absolute left-0 top-3 text-[11px] leading-none text-fg-muted"
        >
          ↳
        </span>
      )}
      <span
        aria-hidden
        className={`absolute ${isBranch ? 'left-3' : '-left-3'} top-3 h-2 w-2 rounded-full ring-2 ring-surface ${dotColor}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span className={`font-mono ${isBranch ? 'text-amber-600' : 'text-fg/80'}`}>
            {review.hash}
          </span>
          <span>·</span>
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{ backgroundColor: authorColor }}
            aria-hidden
          >
            {authorEmoji}
          </span>
          <Link
            href={`/u/${review.author_id}`}
            className="font-medium text-fg hover:underline"
          >
            {authorName}
          </Link>
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
            {onReply && (
              <button
                type="button"
                onClick={onReply}
                disabled={pendingMutate}
                title="이 commit 에 답글 달기"
                className="text-[10px] text-fg-muted hover:text-fg disabled:opacity-50"
              >
                ↪ reply
              </button>
            )}
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
          {renderMessageWithMentions(review.message)}
        </p>
      </div>
    </div>
  );
}
