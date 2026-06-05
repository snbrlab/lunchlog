'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { closePullRequest, mergePullRequest } from '@/lib/pull-requests/actions';
import type { AdminPRRow } from './page';

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: 'OPEN', cls: 'bg-emerald-100 text-emerald-800' },
  merged: { label: 'MERGED', cls: 'bg-sky-100 text-sky-800' },
  closed: { label: 'CLOSED', cls: 'bg-fg/10 text-fg-muted' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export function PRAdminList({ rows }: { rows: AdminPRRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<'all' | 'open' | 'merged' | 'closed'>('open');

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  function onMerge(pr: AdminPRRow) {
    if (
      !confirm(
        `merge 하시겠어요?\n${pr.source?.name} (commit ${pr.source?.commit_count}) → ${pr.target?.name} (commit ${pr.target?.commit_count})\n\nsource 의 리뷰/찜이 target 으로 이전되고 source 는 삭제됩니다.`,
      )
    )
      return;
    setPendingId(pr.id);
    startTransition(async () => {
      const r = await mergePullRequest(pr.id);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function onClose(pr: AdminPRRow) {
    if (!confirm('이 PR 을 거부하시겠어요?')) return;
    setPendingId(pr.id);
    startTransition(async () => {
      const r = await closePullRequest(pr.id);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface p-3 text-[11px]">
        <span className="mr-1 text-fg-muted">상태:</span>
        {(['open', 'merged', 'closed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-full px-2 py-0.5 transition ${
              filter === s ? 'bg-fg text-bg' : 'bg-bg text-fg-muted hover:bg-fg/5'
            }`}
          >
            {s === 'all' ? '전체' : STATUS_LABEL[s]!.label}
            <span className="ml-1 text-[10px] opacity-70">
              ({s === 'all' ? rows.length : rows.filter((r) => r.status === s).length})
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-fg-muted">
          PR 이 없어요
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((pr) => {
            const status = STATUS_LABEL[pr.status]!;
            return (
              <li
                key={pr.id}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <header className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${status.cls}`}
                  >
                    {status.label}
                  </span>
                  <span className="font-medium text-fg">{pr.opener?.name ?? '?'}</span>
                  <span className="text-fg-muted">제안 · {timeAgo(pr.created_at)}</span>
                  {pr.reviewed_at && (
                    <span className="text-fg-muted/70">
                      · {pr.reviewer?.name ?? '?'} 처리 {timeAgo(pr.reviewed_at)}
                    </span>
                  )}
                </header>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs">
                    <span className="text-rose-700">source:</span>{' '}
                    <span className="font-medium text-fg">
                      {pr.source?.name ?? '(삭제됨)'}
                    </span>
                    {pr.source && (
                      <span className="ml-1 text-fg-muted">
                        commit {pr.source.commit_count}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="text-fg-muted">
                    →
                  </span>
                  <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs">
                    <span className="text-emerald-700">target:</span>{' '}
                    <span className="font-medium text-fg">
                      {pr.target?.name ?? '(삭제됨)'}
                    </span>
                    {pr.target && (
                      <span className="ml-1 text-fg-muted">
                        commit {pr.target.commit_count}
                      </span>
                    )}
                  </span>
                </div>

                {pr.reason && (
                  <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-bg px-3 py-2 text-xs text-fg">
                    {pr.reason}
                  </p>
                )}

                {pr.status === 'open' && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onMerge(pr)}
                      disabled={pendingId === pr.id || !pr.source || !pr.target}
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:opacity-40"
                    >
                      {pendingId === pr.id ? '실행 중…' : '🔀 merge'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onClose(pr)}
                      disabled={pendingId === pr.id}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-40"
                    >
                      거부
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
