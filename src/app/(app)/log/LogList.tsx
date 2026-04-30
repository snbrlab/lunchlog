'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatRelativeTime } from '@/lib/format-time';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import type { LogReviewRow } from './page';

type MealFilter = 'all' | 'lunch' | 'dinner';
type DateRange = 'all' | '7d' | '30d';

export default function LogList({ rows }: { rows: LogReviewRow[] }) {
  const [meal, setMeal] = useState<MealFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [showReverted, setShowReverted] = useState(false);
  const [query, setQuery] = useState('');

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
  }, [rows, meal, dateRange, showReverted, query]);

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

      <div className="text-xs text-fg-muted">{filtered.length} 건</div>

      <ol className="rounded-lg border border-border bg-surface">
        {filtered.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-fg-muted">조건에 맞는 commit 이 없어</li>
        )}
        {filtered.map((r) => (
          <LogItem key={r.id} row={r} />
        ))}
      </ol>
    </div>
  );
}

function LogItem({ row }: { row: LogReviewRow }) {
  const created = new Date(row.created_at);
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
    <li className={`flex gap-3 border-t border-border px-4 py-3 first:border-t-0 ${row.reverted ? 'opacity-60' : ''}`}>
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
        style={{ background: authorColor }}
        aria-hidden
      >
        {authorEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-fg-muted">
          <span className="font-mono text-fg/80">{row.hash}</span>
          <span>·</span>
          <span className="font-medium text-fg">{authorName}</span>
          <span>가</span>
          {restaurantNode}
          <span>에</span>
          <span title={row.meal_time === 'lunch' ? '점심' : '저녁'} aria-hidden>
            {row.meal_time === 'lunch' ? '☀' : '☾'}
          </span>
          {row.party_size != null && <span>👥{row.party_size}</span>}
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
