'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { haversineDistanceMeters, travelInfo } from '@/lib/distance';
import { toggleRestaurantClosed } from '@/lib/restaurants/actions';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { ReviewLog } from './ReviewLog';
import { ReviewComposer } from './ReviewComposer';
import type { Restaurant } from '@/types/db';

interface Props {
  origin: { lat: number; lng: number };
  restaurant: Restaurant | null;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
}

// SPEC 5.4 디테일 패널.
export function RestaurantDetailPanel({ origin, restaurant, currentUserId, isAdmin, onClose }: Props) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  function onToggleClosed() {
    if (!restaurant) return;
    const next = !restaurant.is_closed;
    if (!confirm(next ? '폐업 처리할까?' : '폐업 해제할까?')) return;
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
    restaurant.recommended_min_size && restaurant.recommended_max_size
      ? restaurant.recommended_min_size === restaurant.recommended_max_size
        ? `${restaurant.recommended_min_size}인`
        : `${restaurant.recommended_min_size}~${restaurant.recommended_max_size}인`
      : null;

  return (
    <section className="z-30 flex flex-col border-t border-border bg-surface max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:max-h-[60%] max-lg:shadow-2xl lg:h-[420px] lg:shrink-0">
      {restaurant.is_closed && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-xs font-medium text-amber-800">
          ⚠️ 폐업한 식당입니다
        </div>
      )}

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
          <span className="truncate">{restaurant.name}</span>
          {restaurant.has_alcohol && (
            <span aria-label="술 가능" title="술 가능 (회식/한잔)">🍺</span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          {(restaurant.created_by === currentUserId || isAdmin) && (
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
        <span className="rounded-full bg-fg/10 px-2.5 py-0.5 text-xs font-medium text-fg">
          {restaurant.cuisine_type}
        </span>
        {restaurant.menu_tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted"
          >
            {tag}
          </span>
        ))}
      </div>

      {restaurant.note && (
        <p className="mt-2 px-5 text-[12px] italic text-fg-muted">{restaurant.note}</p>
      )}

      {/* 등록자 (모바일 hidden) */}
      {restaurant.creator && (
        <p className="mt-2 hidden items-center gap-1.5 px-5 text-[11px] text-fg-muted lg:flex">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]"
            style={{ backgroundColor: restaurant.creator.avatar_color }}
            aria-hidden
          >
            {resolveAvatarEmoji(
              restaurant.creator.avatar_emoji,
              restaurant.creator.name + (restaurant.created_by ?? ''),
            )}
          </span>
          등록: <span className="font-medium text-fg">{restaurant.creator.name}</span>
        </p>
      )}

      {/* 카카오맵 외부 링크 — place_url 있으면 식당 상세 페이지로, 없으면 좌표 fallback */}
      <a
        href={
          restaurant.kakao_place_url ??
          `https://map.kakao.com/link/map/${encodeURIComponent(restaurant.name)},${restaurant.latitude},${restaurant.longitude}`
        }
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 self-start px-5 text-[11px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      >
        <span aria-hidden>🗺️</span>
        {restaurant.kakao_place_url ? '카카오맵에서 보기 (리뷰/메뉴 포함)' : '카카오맵 위치 보기'}
        ↗
      </a>

      {/* 4) REVIEW LOG */}
      <div className="mt-2 min-h-0 flex-1">
        <ReviewLog
          restaurantId={restaurant.id}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          refreshKey={refreshKey}
          onMutated={triggerRefresh}
        />
      </div>

      {/* 5) Composer */}
      <ReviewComposer restaurantId={restaurant.id} onCreated={triggerRefresh} />
    </section>
  );
}
