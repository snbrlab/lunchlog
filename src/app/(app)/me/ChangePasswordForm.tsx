'use client';

import { useRef, useState, useTransition } from 'react';
import { changePassword, type ChangePasswordResult } from './actions';

export default function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ChangePasswordResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const r = await changePassword(formData);
      setResult(r);
      if (r.ok) formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3 rounded-lg border border-border bg-surface p-5">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">새 비밀번호</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none transition focus:border-fg focus:ring-2 focus:ring-fg/10 disabled:opacity-60"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-fg">비밀번호 확인</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          disabled={pending}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg outline-none transition focus:border-fg focus:ring-2 focus:ring-fg/10 disabled:opacity-60"
        />
      </label>

      {result?.ok && (
        <p className="text-sm text-emerald-600">비밀번호 변경 완료!</p>
      )}
      {result && !result.ok && <p className="text-sm text-red-500">{result.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '변경'}
      </button>

      <p className="pt-1 text-xs text-fg-muted">최소 8자 이상.</p>
    </form>
  );
}
