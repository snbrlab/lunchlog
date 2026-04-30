'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateReport } from '@/lib/admin/reports-actions';
import { formatRelativeTime } from '@/lib/format-time';

interface Row {
  id: string;
  category: 'bug' | 'feature' | 'restaurant' | 'other';
  message: string;
  status: 'open' | 'reviewing' | 'resolved';
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  author: { name: string; email: string } | null;
}

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

export default function ReportsAdminTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changeStatus(row: Row, next: Row['status'], note?: string) {
    setPendingId(row.id);
    startTransition(async () => {
      const r = await updateReport(row.id, { status: next, adminNote: note });
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

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
        <ReportCard
          key={r.id}
          report={r}
          pending={pendingId === r.id}
          onStatusChange={(next, note) => changeStatus(r, next, note)}
        />
      ))}
    </ol>
  );
}

function ReportCard({
  report,
  pending,
  onStatusChange,
}: {
  report: Row;
  pending: boolean;
  onStatusChange: (status: Row['status'], note?: string) => void;
}) {
  const [note, setNote] = useState(report.admin_note ?? '');
  const created = new Date(report.created_at);

  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
        <span className="rounded bg-fg/10 px-1.5 py-0.5 font-medium text-fg">
          {CATEGORY_LABEL[report.category]}
        </span>
        <span>{report.author?.name ?? '(?)'} · {report.author?.email}</span>
        <span>·</span>
        <span>{formatRelativeTime(created)}</span>
        <span
          className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_COLOR[report.status]}`}
        >
          {STATUS_LABEL[report.status]}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-fg">{report.message}</p>

      <div className="mt-3 space-y-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-fg-muted">admin 메모 (사용자에게 보임)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {(['open', 'reviewing', 'resolved'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatusChange(s, note)}
              disabled={pending || (s === report.status && note === (report.admin_note ?? ''))}
              className={`rounded border px-2 py-1 text-[11px] transition ${
                s === report.status
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-fg-muted hover:border-fg/40 hover:text-fg'
              } disabled:opacity-40`}
            >
              → {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    </li>
  );
}
