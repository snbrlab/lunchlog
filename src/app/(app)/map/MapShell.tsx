'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { KakaoMap } from '@/components/map/KakaoMap';
import { RestaurantSidebar } from '@/components/map/RestaurantSidebar';
import { RestaurantDetailPanel } from '@/components/map/RestaurantDetailPanel';
import type { CuisineItem } from '@/lib/cuisine';
import type { RestaurantListItem } from '@/types/db';

interface Props {
  origin: { lat: number; lng: number };
  restaurants: RestaurantListItem[];
  currentUserId: string;
  isAdmin: boolean;
  favoriteIds: string[];
  cuisineItems: CuisineItem[];
}

export default function MapShell({
  origin,
  restaurants,
  currentUserId,
  isAdmin,
  favoriteIds,
  cuisineItems,
}: Props) {
  // 찜 목록은 client state 로 관리 — toggle 시 즉시 반영, server 는 router.refresh 로 동기
  const [favoriteSet, setFavoriteSet] = useState(() => new Set(favoriteIds));
  // server 에서 새 favoriteIds 가 내려오면 (router.refresh 후) 동기화
  useEffect(() => {
    setFavoriteSet(new Set(favoriteIds));
  }, [favoriteIds]);
  const searchParams = useSearchParams();
  const focusParam = searchParams.get('focus');

  const [selectedId, setSelectedId] = useState<string | null>(focusParam);
  const [sidebarOpen, setSidebarOpen] = useState(false); // 모바일에서만 의미
  const [includeClosed, setIncludeClosed] = useState(false);
  // D63: 사이드바 카테고리/술 필터를 지도 핀에도 반영. MapShell 로 lift-up.
  // 사이드바 안의 검색어(query) 는 사이드바 전용으로 유지 — 지도까지 마커 사라지면 혼란
  const [cuisineGroup, setCuisineGroup] = useState<string>('전체');
  const [onlyAlcohol, setOnlyAlcohol] = useState(false);

  // D68: 공유 오피스 등 임시 근무지 — origin 을 GPS/지도클릭으로 덮어쓰기.
  // localStorage 보존 (브라우저별, DB 까지 안 감 — 임시 용도).
  const [customOrigin, setCustomOrigin] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lunchlog.custom_origin.v1');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown };
      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        setCustomOrigin({ lat: parsed.lat, lng: parsed.lng });
      }
    } catch {
      // ignore
    }
  }, []);
  const applyCustomOrigin = (lat: number, lng: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setCustomOrigin({ lat, lng });
    try {
      localStorage.setItem('lunchlog.custom_origin.v1', JSON.stringify({ lat, lng }));
    } catch {
      // ignore
    }
  };
  const clearCustomOrigin = () => {
    setCustomOrigin(null);
    try {
      localStorage.removeItem('lunchlog.custom_origin.v1');
    } catch {
      // ignore
    }
  };
  const effectiveOrigin = customOrigin ?? origin;

  // /log 등에서 ?focus=<id> 로 진입 시 자동 선택
  useEffect(() => {
    if (focusParam) setSelectedId(focusParam);
  }, [focusParam]);

  const selected = useMemo(
    () => restaurants.find((r) => r.id === selectedId) ?? null,
    [restaurants, selectedId],
  );

  // 식당 선택 시 모바일 사이드바 자동 닫힘
  useEffect(() => {
    if (selectedId) setSidebarOpen(false);
  }, [selectedId]);

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* 사이드바 — 데스크탑은 항상 보임. 모바일은 fixed overlay */}
      <div
        className={`absolute inset-y-0 left-0 z-30 transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <RestaurantSidebar
          origin={effectiveOrigin}
          restaurants={restaurants}
          selectedId={selectedId}
          onSelect={setSelectedId}
          includeClosed={includeClosed}
          onIncludeClosedChange={setIncludeClosed}
          favoriteSet={favoriteSet}
          cuisineItems={cuisineItems}
          cuisineGroup={cuisineGroup}
          onCuisineGroupChange={setCuisineGroup}
          onlyAlcohol={onlyAlcohol}
          onOnlyAlcoholChange={setOnlyAlcohol}
        />
      </div>

      {/* 모바일에서 사이드바 열렸을 때 backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="사이드바 닫기"
          className="absolute inset-0 z-20 bg-black/30 lg:hidden"
        />
      )}

      <div className="relative flex flex-1 flex-col">
        <div className="relative flex-1">
          {/* 모바일 햄버거 — 지도 좌상단에 floating */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="식당 목록 열기"
            className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg shadow-md lg:hidden"
          >
            <span aria-hidden className="text-base">☰</span>
          </button>

          <KakaoMap
            origin={effectiveOrigin}
            restaurants={restaurants}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDeselect={() => setSelectedId(null)}
          customOriginActive={!!customOrigin}
          onSetCustomOrigin={applyCustomOrigin}
          onClearCustomOrigin={clearCustomOrigin}
            includeClosed={includeClosed}
            cuisineItems={cuisineItems}
            cuisineGroup={cuisineGroup}
            onlyAlcohol={onlyAlcohol}
          />
        </div>
        <RestaurantDetailPanel
          origin={effectiveOrigin}
          restaurant={selected}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
          isFavorited={selected ? favoriteSet.has(selected.id) : false}
          onFavoriteToggle={(restaurantId, next) => {
            setFavoriteSet((prev) => {
              const copy = new Set(prev);
              if (next) copy.add(restaurantId);
              else copy.delete(restaurantId);
              return copy;
            });
          }}
        />
      </div>
    </div>
  );
}
