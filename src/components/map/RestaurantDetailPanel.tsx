'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { haversineDistanceMeters, travelInfo } from '@/lib/distance';
import { toggleRestaurantClosed } from '@/lib/restaurants/actions';
import { toggleFavorite } from '@/lib/favorites/actions';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { ReviewLog } from './ReviewLog';
import { ReviewComposer, type ReplyTarget } from './ReviewComposer';
import { OpenPullRequestModal } from './OpenPullRequestModal';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  fetchRestaurantDetail,
  type RestaurantDetailExtra,
} from '@/lib/restaurants/detail';
import type { RestaurantListItem } from '@/types/db';

interface Props {
  origin: { lat: number; lng: number };
  restaurant: RestaurantListItem | null;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  isFavorited: boolean;
  onFavoriteToggle: (restaurantId: string, next: boolean) => void;
}

// SPEC 5.4 디테일 패널.
export function RestaurantDetailPanel({
  origin,
  restaurant,
  currentUserId,
  isAdmin,
  onClose,
  isFavorited,
  onFavoriteToggle,
}: Props) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, startTransition] = useTransition();
  // 답글 모드 (D40). 답글 대상 commit 정보를 ReviewComposer 에 전달.
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  // D55: 디테일 전용 컬럼 — 패널 열릴 때 단건 fetch
  const [detail, setDetail] = useState<RestaurantDetailExtra | null>(null);
  // D78: PR 모달 열림 여부
  const [prOpen, setPrOpen] = useState(false);

  // 다른 식당으로 전환되면 답글 상태 초기화 (잘못된 식당의 commit 에 답글 가는 것 방지)
  useEffect(() => {
    setReplyTo(null);
  }, [restaurant?.id]);

  // D55: 식당 선택 시 디테일 fetch. 식당 바뀌면 즉시 stale 표시 (null) → 새로 받음
  useEffect(() => {
    if (!restaurant?.id) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    const supabase = createSupabaseBrowserClient();
    fetchRestaurantDetail(supabase, restaurant.id).then((d) => {
      if (cancelled) return;
      setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurant?.id, refreshKey]);
  // ReviewLog 내부 목록 + 부모 페이지의 restaurants(commit_count, last_commit_at) 둘 다 갱신
  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
    router.refresh();
    // 작성 후 답글 모드 자동 해제
    setReplyTo(null);
  };

  function onToggleClosed() {
    if (!restaurant) return;
    const next = !restaurant.is_closed;
    if (!confirm(next ? '폐업 처리할까요?' : '폐업 해제할까요?')) return;
    startTransition(async () => {
      const r = await toggleRestaurantClosed(restaurant.id, next);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh(); // 식당 목록 SSR 재요청 → is_closed 갱신
    });
  }

  if (!restaurant) {
    return (
      <section className="hidden h-[300px] shrink-0 items-center justify-center border-t border-border bg-surface px-6 text-center lg:flex">
        <p className="text-xs text-fg-muted">
          좌측 식당 카드 또는 지도 핀을 클릭하면 상세가 여기에 표시됩니다.
        </p>
      </section>
    );
  }

  const meters = haversineDistanceMeters(origin, {
    lat: restaurant.latitude,
    lng: restaurant.longitude,
  });
  const travel = travelInfo(meters);

  const sizeRange =
    detail?.recommended_min_size && detail.recommended_max_size
      ? detail.recommended_min_size === detail.recommended_max_size
        ? `${detail.recommended_min_size}인`
        : `${detail.recommended_min_size}~${detail.recommended_max_size}인`
      : null;

  return (
    <section className="z-30 flex flex-col overflow-hidden border-t border-border bg-surface max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[75dvh] max-lg:shadow-2xl lg:h-[500px] lg:shrink-0">
      {restaurant.is_closed && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-xs font-medium text-amber-800">
          ⚠️ 폐업한 식당입니다
        </div>
      )}

      {/* composer 위 영역을 단일 스크롤 컨테이너로 — flex-1 + min-h-0 + overflow-y-auto.
          이전엔 ReviewLog 내부에서만 스크롤하려 했는데 모바일에서 height 전파 불안정해서 안 됐음. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">

      {/* 1) 경로 정보 바 */}
      <div className="flex items-center justify-between border-b border-border bg-bg px-5 py-2.5 text-[13px]">
        <p className="flex min-w-0 items-center gap-2 truncate text-fg">
          <span aria-hidden className="text-marker">■</span>
          <span className="text-fg-muted">회사</span>
          <span aria-hidden className="text-fg-muted">→</span>
          <span aria-hidden className="text-pin-active">●</span>
          <span className="truncate font-medium">{restaurant.name}</span>
        </p>
        <p className="ml-3 shrink-0 text-fg-muted">
          <span aria-hidden className="mr-1">{travel.icon}</span>
          {travel.label} <span className="font-semibold text-fg">{travel.minutes}분</span>
          <span className="mx-1.5">·</span>약 {Math.round(meters)}m
        </p>
      </div>

      {/* 2) 식당 헤더 */}
      <div className="flex items-baseline justify-between gap-3 px-5 pt-3">
        <h2 className="flex min-w-0 items-center gap-1.5 truncate text-base font-semibold tracking-tight text-fg">
          <button
            type="button"
            onClick={() => {
              const next = !isFavorited;
              // 낙관적 UI: 부모 state 즉시 업데이트
              onFavoriteToggle(restaurant.id, next);
              startTransition(async () => {
                const r = await toggleFavorite(restaurant.id);
                if (!r.ok) {
                  // 실패 시 롤백
                  onFavoriteToggle(restaurant.id, !next);
                  alert(r.message);
                }
              });
            }}
            disabled={pending}
            aria-label={isFavorited ? '찜 해제' : '찜하기'}
            title={isFavorited ? '찜 해제' : '나중에 가볼 곳으로 찜'}
            className="text-base disabled:opacity-50"
          >
            <span className={isFavorited ? 'text-amber-500' : 'text-fg-muted'}>
              {isFavorited ? '★' : '☆'}
            </span>
          </button>
          <span className="truncate">{restaurant.name}</span>
          {restaurant.has_alcohol && (
            <span aria-label="술 가능" title="술 가능 (회식/한잔)">🍺</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {(detail?.created_by === currentUserId || isAdmin) && (
            <Link
              href={`/restaurants/${restaurant.id}/edit`}
              className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted transition hover:border-fg/40 hover:text-fg"
              title={isAdmin ? '관리자 권한' : '내가 등록한 식당'}
            >
              수정
            </Link>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={onToggleClosed}
              disabled={pending}
              className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
              title="관리자 권한"
            >
              {pending ? '…' : restaurant.is_closed ? '폐업 해제' : '폐업 처리'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setPrOpen(true)}
            className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-muted transition hover:border-sky-400 hover:text-sky-700"
            title="다른 식당과 중복인 거 같으면 PR 열기 (관리자가 검토)"
          >
            🔀 PR
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-fg-muted hover:text-fg"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="mt-0.5 px-5 text-[11px] text-fg-muted">
        <span className="font-mono">{'₩'.repeat(restaurant.price_level)}</span>
        <span className="mx-1.5">·</span>commit {restaurant.commit_count}
        {sizeRange && (
          <>
            <span className="mx-1.5">·</span>추천 {sizeRange}
          </>
        )}
      </p>

      {/* 3) cuisine + menu_tags */}
      <div className="flex flex-wrap items-center gap-1.5 px-5 pt-2">
        {restaurant.cuisine_types.map((c) => (
          <span
            key={c}
            className="rounded-full bg-fg/10 px-2.5 py-0.5 text-xs font-medium text-fg"
          >
            {c}
          </span>
        ))}
        {restaurant.menu_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      {detail?.note && (
        <p className="mt-2 px-5 text-[12px] italic text-fg-muted">{detail.note}</p>
      )}

      {/* 등록자 (모바일 hidden) */}
      {detail?.creator && (
        <p className="mt-2 hidden items-center gap-1.5 px-5 text-[11px] text-fg-muted lg:flex">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{ backgroundColor: detail.creator.avatar_color }}
            aria-hidden
          >
            {resolveAvatarEmoji(
              detail.creator.avatar_emoji,
              detail.creator.name + (detail.created_by ?? ''),
            )}
          </span>
          등록: <span className="font-medium text-fg">{detail.creator.name}</span>
        </p>
      )}

      {/* 카카오맵 외부 링크 — place_url 있으면 식당 상세 페이지로, 없으면 좌표 fallback */}
      <a
        href={
          detail?.kakao_place_url ??
          `https://map.kakao.com/link/map/${encodeURIComponent(restaurant.name)},${restaurant.latitude},${restaurant.longitude}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 self-start px-5 text-[11px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      >
        <span aria-hidden>🗺️</span>
        {detail?.kakao_place_url ? '카카오맵에서 보기 (리뷰/메뉴 포함)' : '카카오맵 위치 보기'}
        ↗
      </a>

      {/* 4) REVIEW LOG — 자체 스크롤 없음. 부모 스크롤 컨테이너가 처리. */}
      <div className="mt-2">
        <ReviewLog
          restaurantId={restaurant.id}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          refreshKey={refreshKey}
          onMutated={triggerRefresh}
          onReply={setReplyTo}
        />
      </div>

      </div>{/* 단일 스크롤 컨테이너 종료 */}

      {/* 5) Composer */}
      <ReviewComposer
        restaurantId={restaurant.id}
        onCreated={triggerRefresh}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* D78/D80: PR 열기 모달 (병합 + 정보 수정) */}
      {prOpen && (
        <OpenPullRequestModal
          restaurant={{
            id: restaurant.id,
            name: restaurant.name,
            price_level: restaurant.price_level,
            cuisine_types: restaurant.cuisine_types,
            address: detail?.address ?? '',
            has_alcohol: restaurant.has_alcohol,
            kakao_place_url: detail?.kakao_place_url ?? null,
          }}
          onClose={() => setPrOpen(false)}
        />
      )}
    </section>
  );
}
