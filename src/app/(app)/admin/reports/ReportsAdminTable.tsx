'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateReport } from '@/lib/admin/reports-actions';
import { deleteReport } from '@/lib/reports/comment-actions';
import { formatRelativeTime } from '@/lib/format-time';
import {
  ReportThread,
  type CommentEntry,
  type ReportMeta,
} from '@/components/reports/ReportThread';
import type { AdminReportRow } from './page';

const CATEGORY_LABEL = {
  bug: '🐞 버그',
  feature: '💡 기능',
  restaurant: '🍽️ 식당',
  other: '💬 기타',
};
const STATUS_LABEL = {
  open: '접수',
  reviewing: '확인중',
  resolved: '완료',
};
const STATUS_COLOR = {
  open: 'bg-fg/10 text-fg',
  reviewing: 'bg-amber-100 text-amber-800',
  resolved: 'bg-emerald-100 text-emerald-800',
};

export default function ReportsAdminTable({
  rows,
  currentUserId,
}: {
  rows: AdminReportRow[];
  currentUserId: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-xs text-fg-muted">
        아직 제보가 없어요
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {rows.map((r) => (
        <ReportCard key={r.id} report={r} currentUserId={currentUserId} />
      ))}
    </ol>
  );
}

function ReportCard({
  report,
  currentUserId,
}: {
  report: AdminReportRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: AdminReportRow['status']) {
    if (next === report.status) return;
    startTransition(async () => {
      const r = await updateReport(report.id, { status: next });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (
      !confirm(
        `이 제보를 영구 삭제할까요? (댓글까지 함께 사라짐)\n\n${report.message.slice(0, 80)}`,
      )
    )
      return;
    startTransition(async () => {
      const r = await deleteReport(report.id);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  const meta: ReportMeta = {
    id: report.id,
    message: report.message,
    created_at: report.created_at,
    category: report.category,
    author: report.author ? { id: report.author.id, name: report.author.name } : null,
  };
  const comments: CommentEntry[] = report.comments.map((c) => ({
    id: c.id,
    author_id: c.author_id,
    body: c.body,
    created_at: c.created_at,
    author: c.author
      ? { id: c.author.id, name: c.author.name, role: c.author.role }
      : null,
  }));

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
        <span className="rounded bg-fg/10 px-1.5 py-0.5 font-medium text-fg">
          {CATEGORY_LABEL[report.category]}
        </span>
        <span>
          {report.author?.name ?? '(?)'} · {report.author?.email}
        </span>
        <span>·</span>
        <span>{formatRelativeTime(new Date(report.created_at))}</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[report.status]}`}
        >
          {STATUS_LABEL[report.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-fg-muted">상태:</span>
        {(['open', 'reviewing', 'resolved'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => changeStatus(s)}
            disabled={pending || s === report.status}
            className={`rounded border px-2 py-0.5 text-[11px] transition ${
              s === report.status
                ? 'border-fg bg-fg text-bg'
                : 'border-border text-fg-muted hover:border-fg/40 hover:text-fg'
            } disabled:opacity-40`}
          >
            → {STATUS_LABEL[s]}
          </button>
        ))}
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="ml-auto rounded border border-red-300 px-2 py-0.5 text-[11px] text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          🗑 제보 삭제
        </button>
      </div>

      {/* legacy admin_note 가 있는 옛 제보 — 마이그레이션 후 표시용 */}
      {report.admin_note && comments.length === 0 && (
        <p className="mt-3 rounded border-l-2 border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span className="font-medium">(legacy admin 메모): </span>
          {report.admin_note}
        </p>
      )}

      <div className="mt-3">
        <ReportThread
          report={meta}
          comments={comments}
          currentUserId={currentUserId}
          isAdmin
          status={report.status}
        />
      </div>
    </li>
  );
}
