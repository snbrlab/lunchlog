'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setUserRole } from '@/lib/admin/actions';

interface Row {
  id: string;
  email: string;
  name: string;
  role: 'member' | 'admin';
  department: string | null;
  building: { name: string } | null;
}

export default function UsersTable({
  rows,
  currentUserId,
}: {
  rows: Row[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggleRole(row: Row) {
    const next = row.role === 'admin' ? 'member' : 'admin';
    if (
      !confirm(
        `${row.name} (${row.email}) 의 권한을 ${row.role} → ${next} 로 변경할까요?`,
      )
    )
      return;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await setUserRole(row.id, next);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-[11px] uppercase tracking-wider text-fg-muted">
          <tr>
            <th className="px-3 py-2 text-left">이름</th>
            <th className="px-3 py-2 text-left">이메일</th>
            <th className="px-3 py-2 text-left">근무지</th>
            <th className="px-3 py-2 text-left">역할</th>
            <th className="px-3 py-2 text-left">액션</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-fg">
                {r.name}
                {r.id === currentUserId && (
                  <span className="ml-1.5 text-[10px] text-fg-muted">(나)</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-fg-muted">{r.email}</td>
              <td className="px-3 py-2 text-xs text-fg-muted">
                {r.building?.name ?? '—'}
                {r.department && ` · ${r.department}`}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    r.role === 'admin'
                      ? 'bg-fg text-bg'
                      : 'bg-fg/10 text-fg-muted'
                  }`}
                >
                  {r.role}
                </span>
              </td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleRole(r)}
                  disabled={pendingId === r.id}
                  className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
                >
                  {pendingId === r.id
                    ? '…'
                    : r.role === 'admin'
                    ? '권한 회수'
                    : 'admin 부여'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
