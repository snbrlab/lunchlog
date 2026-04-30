'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { signInWithPassword, type SignInWithPasswordResult } from './actions';

export default function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);

  function onPasswordSubmit(formData: FormData) {
    setPwError(null);
    startTransition(async () => {
      const r: SignInWithPasswordResult = await signInWithPassword(formData);
      if (!r.ok) setPwError(r.message);
    });
  }

  return (
    <div className="space-y-5">
      <form action={onPasswordSubmit} className="space-y-4">
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

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700">비밀번호</span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            disabled={pending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
          />
        </label>

        {pwError && <p className="text-sm text-red-600">{pwError}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="text-center text-xs text-neutral-500">
        처음이세요?{' '}
        <Link href="/signup" className="font-medium underline-offset-2 hover:underline">
          가입 신청하기
        </Link>
      </div>

      <p className="text-center text-[11px] text-neutral-400">
        비밀번호 분실 시 관리자에게 메신저로 문의 → 임시 비번 발급
      </p>
    </div>
  );
}
