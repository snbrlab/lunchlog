'use client';

import { useState, useTransition } from 'react';
import { setPassword, type SetPasswordResult } from './actions';
import PasswordInput from '@/components/auth/PasswordInput';

export default function SetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r: SetPasswordResult = await setPassword(formData);
      if (!r.ok) setError(r.message);
      // 성공 시 server action 의 redirect 가 처리.
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
          maxLength={72}
          autoComplete="new-password"
          autoFocus
          disabled={pending}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">비밀번호 확인</span>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          maxLength={72}
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
        {pending ? '저장 중…' : '비밀번호 설정 완료'}
      </button>

      <p className="pt-2 text-center text-xs text-neutral-400">
        최소 8자 이상.
      </p>
    </form>
  );
}
