'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementActive,
} from '@/lib/announcements/actions';
import { formatRelativeTime } from '@/lib/format-time';

interface Row {
  id: string;
  body: string;
  active: boolean;
  created_at: string;
  creator: { name: string } | null;
}

const MAX = 200;

export default function AnnouncementsTable({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createAnnouncement(body);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  function toggle(row: Row) {
    setBusyId(row.id);
    startTransition(async () => {
      const r = await setAnnouncementActive(row.id, !row.active);
      setBusyId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function remove(row: Row) {
    if (!confirm(`이 공지를 삭제할까요?\n\n${row.body}`)) return;
    setBusyId(row.id);
    startTransition(async () => {
      const r = await deleteAnnouncement(row.id);
      setBusyId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-medium text-fg">+ 새 공지 작성</h2>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={MAX}
          rows={2}
          placeholder="ex) 5/15 (금) 점심엔 본사 5층 카페테리아 휴무예요"
          className="w-full resize-none rounded border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-fg"
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-fg-muted">
          <span>
            {body.length}/{MAX}
          </span>
          {error && <span className="text-red-500">{error}</span>}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !body.trim()}
            className="rounded bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '게시 중…' : '게시'}
          </button>
        </div>
      </section>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
            <tr>
              <th className="px-3 py-2 text-left">상태</th>
              <th className="px-3 py-2 text-left">내용</th>
              <th className="px-3 py-2 text-left">작성</th>
              <th className="px-3 py-2 text-left">액션</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-xs text-fg-muted">
                  아직 공지가 없어요
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  {r.active ? (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      active
                    </span>
                  ) : (
                    <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                      off
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-fg">{r.body}</td>
                <td className="px-3 py-2 text-[11px] text-fg-muted">
                  {r.creator?.name ?? '(?)'} · {formatRelativeTime(new Date(r.created_at))}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggle(r)}
                      disabled={busyId === r.id}
                      className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
                    >
                      {r.active ? '내리기' : '다시 노출'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r)}
                      disabled={busyId === r.id}
                      className="rounded border border-red-300 px-2 py-1 text-[11px] text-red-600 transition hover:border-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
