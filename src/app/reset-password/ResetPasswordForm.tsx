'use client';

import { useState, useTransition } from 'react';
import PasswordInput from '@/components/auth/PasswordInput';
import { resetPassword, type ResetPasswordResult } from './actions';

export default function ResetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r: ResetPasswordResult = await resetPassword(formData);
      if (!r.ok) setError(r.message);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">새 비밀번호</span>
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
        <span className="mt-1 block text-xs text-neutral-500">8자 이상</span>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">비밀번호 확인</span>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? '저장 중…' : '비밀번호 변경'}
      </button>
    </form>
  );
}
