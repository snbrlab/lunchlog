'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { formatRelativeTime } from '@/lib/format-time';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { LOG_PAGE_SIZE, type LogReviewRow } from '@/lib/reviews/log';
import { loadMoreReviewLog } from './actions';
import { BadgeChip } from '@/components/badges/BadgeChip';
import ReactionBar from '@/components/map/ReactionBar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Office } from '@/types/db';

type MealFilter = 'all' | 'lunch' | 'dinner';
type DateRange = 'all' | '7d' | '30d';

export default function LogList({
  initialRows,
  offices,
  currentUserId,
}: {
  initialRows: LogReviewRow[];
  offices: Office[];
  currentUserId: string;
}) {
  const [meal, setMeal] = useState<MealFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [showReverted, setShowReverted] = useState(false);
  const [query, setQuery] = useState('');
  // 식당 지역 필터 — 'all' / office.id / 'none' (미분류). D72 의미: 작성자 근무지 → 식당 지역
  const [officeFilter, setOfficeFilter] = useState<string>('all');

  // D64: keyset 페이지네이션 — 누적 rows + "더 보기"
  const [rows, setRows] = useState<LogReviewRow[]>(initialRows);
  const [hasMore, setHasMore] = useState(initialRows.length === LOG_PAGE_SIZE);
  const [loadingMore, startLoadMore] = useTransition();
  // D79: 모바일에서 reaction + 버튼 활성화된 row id (hover 가 없으니 tap 으로 active)
  const [activeId, setActiveId] = useState<string | null>(null);

  function loadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    startLoadMore(async () => {
      const res = await loadMoreReviewLog(last.created_at);
      setRows((prev) => {
        // 중복 방지 (created_at 동률 경계 안전)
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.rows.filter((r) => !seen.has(r.id))];
      });
      setHasMore(res.hasMore);
    });
  }

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateRange === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : dateRange === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showReverted && r.reverted) return false;
      if (meal !== 'all' && r.meal_time !== meal) return false;
      if (cutoff > 0 && new Date(r.created_at).getTime() < cutoff) return false;
      if (officeFilter === 'none') { if (r.restaurant?.office_id) return false; }
      else if (officeFilter !== 'all' && r.restaurant?.office_id !== officeFilter) return false;
      if (q) {
        const hay = [
          r.message,
          r.author?.name ?? '',
          r.restaurant?.name ?? '',
          r.hash,
        ]
          .join('|')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, meal, dateRange, showReverted, query, officeFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 메시지 / 작성자 / 식당"
          className="h-9 flex-1 min-w-[10rem] rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-fg"
        />
        <div className="flex gap-1">
          {(['all', 'lunch', 'dinner'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMeal(m)}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
                m === meal
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border bg-surface text-fg-muted hover:border-fg/40'
              }`}
            >
              {m === 'all' ? '전체' : m === 'lunch' ? '☀ 점심' : '☾ 저녁'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(['all', '30d', '7d'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDateRange(d)}
              className={`rounded-md border px-2.5 py-1.5 text-xs transition ${
                d === dateRange
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border bg-surface text-fg-muted hover:border-fg/40'
              }`}
            >
              {d === 'all' ? '기간 전체' : d === '30d' ? '30일' : '7일'}
            </button>
          ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-fg">
          <input
            type="checkbox"
            checked={showReverted}
            onChange={(e) => setShowReverted(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          revert 포함
        </label>
      </div>

      {/* 식당 지역 필터 (D72 의미 변경: 작성자 근무지 → 식당 지역) */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] text-fg-muted">지역</span>
        <button
          type="button"
          onClick={() => setOfficeFilter('all')}
          className={`rounded-full px-2 py-0.5 text-[11px] transition ${
            officeFilter === 'all'
              ? 'bg-fg text-bg'
              : 'bg-surface text-fg-muted hover:bg-fg/5'
          }`}
        >
          전체
        </button>
        {offices.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setOfficeFilter(o.id)}
            className={`rounded-full px-2 py-0.5 text-[11px] transition ${
              officeFilter === o.id
                ? 'bg-fg text-bg'
                : 'bg-surface text-fg-muted hover:bg-fg/5'
            }`}
          >
            {o.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setOfficeFilter('none')}
          className={`rounded-full px-2 py-0.5 text-[11px] transition ${
            officeFilter === 'none'
              ? 'bg-fg text-bg'
              : 'bg-surface text-fg-muted hover:bg-fg/5'
          }`}
        >
          미분류
        </button>
      </div>

      <div className="text-xs text-fg-muted">
        {filtered.length} 건{' '}
        <span className="text-fg-muted/60">/ 불러온 {rows.length}건 중</span>
      </div>

      <ol className="rounded-lg border border-border bg-surface">
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-fg-muted">조건에 맞는 commit 이 없어요</li>
        )}
        {filtered.map((r) => (
          <LogItem
            key={r.id}
            row={r}
            currentUserId={currentUserId}
            active={activeId === r.id}
            onActivate={() => setActiveId((cur) => (cur === r.id ? null : r.id))}
          />
        ))}
      </ol>

      {/* D64: 더 보기 — keyset 페이지네이션. 검색은 불러온 범위 안에서만 동작 */}
      <div className="flex flex-col items-center gap-2 pt-1">
        {hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md border border-border bg-surface px-4 py-2 text-xs text-fg transition hover:border-fg/40 disabled:opacity-50"
          >
            {loadingMore ? '불러오는 중…' : `더 보기 (+${LOG_PAGE_SIZE})`}
          </button>
        ) : (
          <span className="text-[11px] text-fg-muted/60">마지막까지 다 봤어요</span>
        )}
        <p className="text-[10px] text-fg-muted/60">
          🔍 검색·필터는 불러온 {rows.length}건 안에서 동작해요. 더 찾으려면 “더 보기”로 불러오세요
        </p>
      </div>
    </div>
  );
}

function LogItem({
  row,
  currentUserId,
  active,
  onActivate,
}: {
  row: LogReviewRow;
  currentUserId: string;
  active: boolean;
  onActivate: () => void;
}) {
  const created = new Date(row.created_at);
  // D79: 이 row 의 reactions 만 local state — 다른 row 갱신 없이 단일 row refetch 가능
  const [reactions, setReactions] = useState(row.reactions);

  async function refetchReactions() {
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from('review_reactions')
      .select('emoji, user_id, user:users ( name )')
      .eq('review_id', row.id);
    setReactions(((data ?? []) as unknown) as typeof row.reactions);
  }

  // 모바일: row 의 'non-link' 영역 탭 시 + 버튼 표시 토글.
  // Link/button 클릭은 closest 로 감지해 무시 (네비/토글 우선).
  function onRowClick(e: React.MouseEvent<HTMLLIElement>) {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, [role="button"]')) return;
    onActivate();
  }
  const authorName = row.author?.name ?? '(알수없음)';
  const authorEmoji = resolveAvatarEmoji(row.author?.avatar_emoji ?? null, authorName + row.id);
  const authorColor = row.author?.avatar_color ?? '#fde68a';

  const restaurantNode = row.restaurant ? (
    <Link
      href={`/map?focus=${row.restaurant.id}`}
      className={`font-medium hover:underline ${
        row.restaurant.is_closed ? 'text-fg-muted line-through' : 'text-fg'
      }`}
    >
      {row.restaurant.name}
    </Link>
  ) : (
    <span className="text-fg-muted">(삭제된 식당)</span>
  );

  return (
    <li
      onClick={onRowClick}
      className={`group flex cursor-default gap-3 border-t border-border px-4 py-3 first:border-t-0 ${row.reverted ? 'opacity-60' : ''}`}
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ background: authorColor }}
        aria-hidden
      >
        {authorEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-fg-muted">
          <span className={`font-mono ${row.parent_review_id ? 'text-amber-600' : 'text-fg/80'}`}>
            {row.hash}
          </span>
          <span>·</span>
          {row.author?.id ? (
            <Link
              href={`/u/${row.author.id}`}
              className="font-medium text-fg hover:underline"
            >
              {authorName}
            </Link>
          ) : (
            <span className="font-medium text-fg">{authorName}</span>
          )}
          {row.author?.primary_badge_code && (
            <BadgeChip code={row.author.primary_badge_code} size="xs" />
          )}
          <span>가</span>
          {restaurantNode}
          <span>에</span>
          <span title={row.meal_time === 'lunch' ? '점심' : '저녁'} aria-hidden>
            {row.meal_time === 'lunch' ? '☀' : '☾'}
          </span>
          {row.party_size != null && <span>👥{row.party_size}</span>}
          {/* D79: reaction 은 meta 줄 가장 뒤 (인원수 뒤). 자체 줄 없이 inline.
              모바일은 active 시에만 + 보임 (LogItem tap 으로 active). 데스크탑은 hover 로. */}
          <ReactionBar
            reviewId={row.id}
            reactions={reactions}
            currentUserId={currentUserId}
            onChanged={refetchReactions}
            compact
            hideAddByDefault
            forceShowAdd={active}
          />
          <span className="ml-auto whitespace-nowrap">{formatRelativeTime(created)}</span>
        </div>
        <p
          className={`mt-1 text-sm ${
            row.reverted ? 'text-fg-muted line-through' : 'text-fg'
          }`}
        >
          {row.message}
          {row.reverted && (
            <span className="ml-1.5 rounded bg-fg/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-fg-muted">
              REVERTED
            </span>
          )}
        </p>
        {row.parent && (
          <p className="mt-0.5 text-[10px] text-fg-muted/80">
            ↳ <span className="font-mono">{row.parent.hash}</span>
            {row.parent.author?.name && <> · {row.parent.author.name}</>} 의 commit 에 답글
          </p>
        )}
      </div>
    </li>
  );
}
