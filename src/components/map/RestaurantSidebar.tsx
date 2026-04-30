'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { Restaurant } from '@/types/db';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import { haversineDistanceMeters, travelInfo } from '@/lib/distance';
import { CUISINE_GROUPS, findCuisineGroup } from '@/lib/cuisine';
import type { CuisineType } from '@/types/db';

interface Props {
  origin: { lat: number; lng: number };
  restaurants: Restaurant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  includeClosed: boolean;
  onIncludeClosedChange: (next: boolean) => void;
}

type GroupFilter = '전체' | (typeof CUISINE_GROUPS)[number]['label'];

const FILTER_LABELS: GroupFilter[] = [
  '전체',
  ...CUISINE_GROUPS.map((g) => g.label),
];

// 그룹 라벨 → 그 그룹의 모든 cuisine_type value 들
const GROUP_TO_VALUES: Record<string, readonly string[]> = Object.fromEntries(
  CUISINE_GROUPS.map((g) => [g.label, g.items.map((i) => i.value)]),
);

export function RestaurantSidebar({
  origin,
  restaurants,
  selectedId,
  onSelect,
  includeClosed,
  onIncludeClosedChange,
}: Props) {
  const { mode } = useMealMode();
  const [cuisine, setCuisine] = useState<GroupFilter>('전체');
  const [onlyAlcohol, setOnlyAlcohol] = useState(false);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return restaurants
      .filter((r) => r.categories.includes(mode))
      .filter((r) => (includeClosed ? true : !r.is_closed))
      .filter((r) => (onlyAlcohol ? r.has_alcohol : true))
      .filter((r) => {
        if (cuisine === '전체') return true;
        const values = GROUP_TO_VALUES[cuisine];
        if (!values) return false;
        // r.cuisine_types 의 어떤 항목이라도 그룹에 속하면 매치
        return r.cuisine_types.some((c) => values.includes(c));
      })
      .filter((r) => {
        if (!q) return true;
        if (r.name.toLowerCase().includes(q)) return true;
        if (r.menu_tags.some((t) => t.toLowerCase().includes(q))) return true;
        // cuisine 세부값 매치 (예: "곰탕" → cuisine_types 에 "곰탕")
        if (r.cuisine_types.some((c) => c.toLowerCase().includes(q))) return true;
        // cuisine 그룹 라벨 매치 (예: "한식" → 한식 그룹의 모든 sub-cuisine 식당)
        if (
          r.cuisine_types.some((c) => {
            const group = findCuisineGroup(c as CuisineType);
            return group ? group.toLowerCase().includes(q) : false;
          })
        ) {
          return true;
        }
        return false;
      })
      .map((r) => {
        const meters = haversineDistanceMeters(origin, { lat: r.latitude, lng: r.longitude });
        return { r, meters, travel: travelInfo(meters) };
      })
      .sort((a, b) => a.meters - b.meters);
  }, [restaurants, mode, cuisine, includeClosed, onlyAlcohol, origin, query]);

  return (
    <aside className="flex h-full w-[85vw] max-w-[320px] shrink-0 flex-col border-r border-border bg-surface lg:w-[280px]">
      <header className="border-b border-border px-4 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
            SORTED BY DISTANCE
          </p>
          <Link
            href="/log"
            className="text-[10px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            title="최근 commit log 전체 보기"
          >
            📜 최근 commit →
          </Link>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          {items.length}개 식당 · {mode === 'lunch' ? '점심' : '저녁'} 메뉴
        </p>
        <div className="relative mt-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 / 메뉴 / 음식종류 검색"
            className="w-full rounded-md border border-border bg-bg px-3 py-1.5 pr-7 text-xs text-fg outline-none focus:border-fg [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="검색 지우기"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1 text-[11px] text-fg-muted hover:text-fg"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-border px-2 py-2">
        <div className="flex flex-wrap gap-1">
          {FILTER_LABELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCuisine(c)}
              className={`rounded-full px-2 py-0.5 text-[11px] transition ${
                c === cuisine
                  ? 'bg-fg text-bg'
                  : 'bg-bg text-fg-muted hover:bg-fg/5'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-fg-muted">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={onlyAlcohol}
              onChange={(e) => setOnlyAlcohol(e.target.checked)}
              className="h-3 w-3"
            />
            <span aria-hidden>🍺</span>
            술 가능만
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => onIncludeClosedChange(e.target.checked)}
              className="h-3 w-3"
            />
            폐업 포함
          </label>
        </div>
      </div>

      <ol className="flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-xs text-fg-muted">
            조건에 맞는 식당이 아직 없어.<br />
            우상단 “+ 새 맛집” 으로 추가해줘.
          </li>
        )}
        {items.map(({ r, meters, travel }) => {
          const selected = r.id === selectedId;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                aria-pressed={selected}
                className={`flex w-full items-stretch gap-3 border-b border-border px-4 py-3 text-left transition ${
                  selected ? 'bg-fg/5' : 'hover:bg-fg/5'
                }`}
              >
                <div className="flex w-10 flex-col items-center justify-center">
                  <span aria-hidden className="text-xs leading-none">{travel.icon}</span>
                  <span className="mt-0.5 text-base font-medium leading-none text-fg">
                    {travel.minutes}
                  </span>
                  <span className="mt-0.5 text-[10px] uppercase tracking-wider text-fg-muted">
                    min
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-medium text-fg ${
                      r.is_closed ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {r.name}
                    {r.is_closed && (
                      <span className="ml-1.5 rounded bg-fg/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-fg-muted">
                        폐업
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {Math.round(meters)}m · commit {r.commit_count} · {'₩'.repeat(r.price_level)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-muted/80">
                    {r.cuisine_types.join(' / ')}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
