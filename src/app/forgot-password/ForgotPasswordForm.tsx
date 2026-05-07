'use client';

import { useState, useTransition } from 'react';
import {
  requestPasswordReset,
  type RequestPasswordResetResult,
} from './actions';

export default function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r: RequestPasswordResetResult = await requestPasswordReset(formData);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSentTo(r.email);
    });
  }

  if (sentTo) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <p className="font-medium">메일 발송 완료!</p>
          <p className="mt-1.5 break-all">
            <span className="font-mono">{sentTo}</span> 메일함에서 비밀번호 재설정 링크를 확인해주세요.
          </p>
          <p className="mt-2 text-xs text-emerald-700/80">
            ※ 메일이 안 오면 스팸함도 확인해주세요. 그래도 없으면 한도 초과일 수 있으니 잠시 뒤
            다시 시도.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">회사 이메일</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="you@lge.com"
          disabled={pending}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
      >
        {pending ? '메일 보내는 중…' : '재설정 링크 받기'}
      </button>
    </form>
  );
}
