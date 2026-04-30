'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { deleteReview } from '@/lib/reviews/actions';
import type { AdminReviewRow } from './page';

type DateRange = 'all' | '7d' | '30d';

export default function ReviewsTable({ rows }: { rows: AdminReviewRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<AdminReviewRow | null>(null);

  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [showReverted, setShowReverted] = useState(true);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff =
      dateRange === '7d'
        ? now - 7 * 24 * 60 * 60 * 1000
        : dateRange === '30d'
          ? now - 30 * 24 * 60 * 60 * 1000
          : 0;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showReverted && r.reverted) return false;
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
  }, [rows, search, dateRange, showReverted]);

  function onDelete(row: AdminReviewRow) {
    setPendingId(row.id);
    startTransition(async () => {
      const r = await deleteReview(row.id);
      setPendingId(null);
      setConfirm(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 메시지 / 작성자 / 식당 / hash"
          className="h-9 flex-1 min-w-[12rem] rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-fg"
        />
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
              {d === 'all' ? '전체' : d === '30d' ? '30일' : '7일'}
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

      <div className="mb-2 text-xs text-fg-muted">
        {filtered.length} / {rows.length} 건
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">시간</th>
              <th className="px-3 py-2 text-left">작성자</th>
              <th className="px-3 py-2 text-left">식당</th>
              <th className="px-3 py-2 text-left">메시지</th>
              <th className="px-3 py-2 text-left">메타</th>
              <th className="px-3 py-2 text-left">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-border align-top ${r.reverted ? 'opacity-60' : ''}`}
              >
                <td className="px-3 py-2 text-xs text-fg-muted">
                  {new Date(r.created_at).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                  })}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    {r.author?.avatar_emoji && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs"
                        style={{ background: r.author.avatar_color }}
                      >
                        {r.author.avatar_emoji}
                      </span>
                    )}
                    <span className="text-fg">{r.author?.name ?? '—'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.restaurant ? (
                    <span className={r.restaurant.is_closed ? 'text-fg-muted line-through' : 'text-fg'}>
                      {r.restaurant.name}
                    </span>
                  ) : (
                    <span className="text-fg-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 max-w-[24rem]">
                  <span
                    className={`text-sm ${r.reverted ? 'text-fg-muted line-through' : 'text-fg'}`}
                  >
                    {r.message}
                  </span>
                  {r.reverted && (
                    <span className="ml-1.5 rounded bg-rose-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-rose-700">
                      reverted
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-fg-muted">
                  <div className="flex items-center gap-1.5">
                    <span title={r.meal_time}>{r.meal_time === 'lunch' ? '☀' : '☾'}</span>
                    {r.party_size != null && <span>👥{r.party_size}</span>}
                    <span className="font-mono text-[10px] opacity-70">{r.hash}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setConfirm(r)}
                    disabled={pendingId === r.id}
                    className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-fg-muted">
                  조건에 맞는 리뷰가 없어
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirm && (
        <ConfirmDeleteModal
          row={confirm}
          pending={pendingId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => onDelete(confirm)}
        />
      )}
    </>
  );
}

function ConfirmDeleteModal({
  row,
  pending,
  onCancel,
  onConfirm,
}: {
  row: AdminReviewRow;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-fg">리뷰를 삭제할까?</h3>
        <p className="mt-2 text-xs text-fg-muted">
          이 동작은 되돌릴 수 없어. (revert 와 다름 — DB 행을 완전히 제거)
        </p>
        <div className="mt-3 rounded-md border border-border bg-bg p-3 text-xs">
          <div className="text-fg-muted">
            {row.author?.name} · {row.restaurant?.name ?? '—'} · {' '}
            <span className="font-mono">{row.hash}</span>
          </div>
          <div className="mt-1 text-fg">{row.message}</div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-fg hover:bg-fg/5"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {pending ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
