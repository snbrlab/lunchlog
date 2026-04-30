'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { approveSignup, denySignup } from '@/lib/admin/actions';
import type { SignupRow } from './page';

const STATUS_LABEL: Record<SignupRow['status'], string> = {
  pending: '대기',
  approved: '승인',
  denied: '거절',
};

const STATUS_BADGE: Record<SignupRow['status'], string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  denied: 'bg-rose-100 text-rose-800',
};

export default function SignupsTable({ rows }: { rows: SignupRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onApprove(row: SignupRow) {
    if (!confirm(`${row.name} (${row.email}) 가입 승인할까?`)) return;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await approveSignup(row.id);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  function onDeny(row: SignupRow) {
    const reason = prompt(
      `${row.name} (${row.email}) 거절 사유 (선택, 비워도 OK):`,
      '',
    );
    // prompt 취소 시 null
    if (reason === null) return;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await denySignup(row.id, reason);
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
      <div className="rounded-lg border border-border bg-surface px-4 py-8 text-center text-sm text-fg-muted">
        가입 요청이 없어
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2 text-left">상태</th>
            <th className="px-3 py-2 text-left">이름</th>
            <th className="px-3 py-2 text-left">이메일</th>
            <th className="px-3 py-2 text-left">신청일</th>
            <th className="px-3 py-2 text-left">처리</th>
            <th className="px-3 py-2 text-left">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border align-top">
              <td className="px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.status]}`}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-fg">{r.name}</td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.email}</td>
              <td className="px-3 py-2 text-xs text-fg-muted">
                {new Date(r.requested_at).toLocaleString('ko-KR', {
                  timeZone: 'Asia/Seoul',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">
                {r.reviewed_at ? (
                  <>
                    <div>
                      {new Date(r.reviewed_at).toLocaleString('ko-KR', {
                        timeZone: 'Asia/Seoul',
                        month: 'numeric',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                      })}
                    </div>
                    {r.reviewer?.name && <div className="opacity-70">by {r.reviewer.name}</div>}
                    {r.denied_reason && (
                      <div className="mt-0.5 text-rose-600">사유: {r.denied_reason}</div>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
                {r.status === 'pending' ? (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onApprove(r)}
                      disabled={pendingId === r.id}
                      className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      승인
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeny(r)}
                      disabled={pendingId === r.id}
                      className="rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      거절
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-fg-muted/70">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
