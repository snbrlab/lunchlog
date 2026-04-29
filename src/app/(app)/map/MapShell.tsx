'use client';

import { useEffect, useMemo, useState } from 'react';
import { KakaoMap } from '@/components/map/KakaoMap';
import { RestaurantSidebar } from '@/components/map/RestaurantSidebar';
import { RestaurantDetailPanel } from '@/components/map/RestaurantDetailPanel';
import type { Restaurant } from '@/types/db';

interface Props {
  origin: { lat: number; lng: number };
  restaurants: Restaurant[];
  currentUserId: string;
  isAdmin: boolean;
}

export default function MapShell({ origin, restaurants, currentUserId, isAdmin }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // 모바일에서만 의미
  const [includeClosed, setIncludeClosed] = useState(false);

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
          origin={origin}
          restaurants={restaurants}
          selectedId={selectedId}
          onSelect={setSelectedId}
          includeClosed={includeClosed}
          onIncludeClosedChange={setIncludeClosed}
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

      <div className="flex flex-1 flex-col">
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
            origin={origin}
            restaurants={restaurants}
            selectedId={selectedId}
            onSelect={setSelectedId}
            includeClosed={includeClosed}
          />
        </div>
        <RestaurantDetailPanel
          origin={origin}
          restaurant={selected}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
