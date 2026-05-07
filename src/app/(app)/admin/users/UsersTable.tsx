'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setUserRole, resetUserPassword, createUserManually } from '@/lib/admin/actions';

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
  const [tempPwModal, setTempPwModal] = useState<{ name: string; email: string; pw: string } | null>(
    null,
  );
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

  function resetPw(row: Row) {
    if (
      !confirm(
        `${row.name} (${row.email}) 비밀번호를 임시값으로 초기화할까요?\n\n` +
          `초기화하면 다음 로그인 시 비번 재설정 페이지로 이동돼요.\n` +
          `생성된 임시 비번은 화면에 한 번만 보여주니까 메신저로 직접 전달해주세요.`,
      )
    )
      return;
    setPendingId(row.id);
    startTransition(async () => {
      const r = await resetUserPassword(row.id);
      setPendingId(null);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setTempPwModal({ name: row.name, email: row.email, pw: r.tempPassword });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <NewUserForm onCreated={(name, email, pw) => setTempPwModal({ name, email, pw })} />

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
                <div className="flex flex-wrap gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => resetPw(r)}
                    disabled={pendingId === r.id}
                    className="rounded border border-border px-2 py-1 text-[11px] text-fg-muted transition hover:border-fg/40 hover:text-fg disabled:opacity-50"
                  >
                    비번 reset
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {tempPwModal && (
        <TempPasswordModal
          name={tempPwModal.name}
          email={tempPwModal.email}
          pw={tempPwModal.pw}
          onClose={() => setTempPwModal(null)}
        />
      )}
    </div>
  );
}

function NewUserForm({
  onCreated,
}: {
  onCreated: (name: string, email: string, pw: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const r = await createUserManually(email, name);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      onCreated(name, r.email, r.tempPassword);
      setEmail('');
      setName('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <div>
          <span className="text-sm font-medium text-fg">+ 사용자 직접 추가</span>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            사내 도메인 아닌 이메일도 OK. 임시비번 자동 생성 (1회 표시).
          </p>
        </div>
        <span className="text-xs text-fg-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border px-5 py-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 (예: guest@example.com)"
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="닉네임"
            maxLength={30}
            disabled={pending}
            className="w-full rounded border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-fg"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !email.trim() || !name.trim()}
            className="rounded bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '생성 중…' : '계정 생성'}
          </button>
          <p className="text-[10px] text-fg-muted/70">
            ※ 생성 직후 임시비번이 1회 표시됩니다. 메신저로 사용자에게 전달해주세요.
            첫 로그인 시 비번 재설정 페이지로 강제 이동됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function TempPasswordModal({
  name,
  email,
  pw,
  onClose,
}: {
  name: string;
  email: string;
  pw: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-fg">임시 비밀번호 생성됨</h3>
        <p className="mt-2 text-xs text-fg-muted">
          <span className="font-medium text-fg">{name}</span>{' '}
          <span className="font-mono">({email})</span> 님에게 메신저로 전달해주세요.
          <br />이 화면을 닫으면 임시 비번을 다시 볼 수 없어요.
        </p>
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 font-mono text-base text-amber-900">
          {pw}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(pw)}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs text-fg hover:bg-fg/5"
          >
            클립보드 복사
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg hover:opacity-90"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
