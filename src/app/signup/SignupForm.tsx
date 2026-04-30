'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { requestSignup, type RequestSignupResult } from './actions';

export default function SignupForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    startTransition(async () => {
      const r: RequestSignupResult = await requestSignup(formData);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSubmittedEmail(email);
    });
  }

  if (submittedEmail) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
          <p className="font-medium">가입 신청 완료!</p>
          <p className="mt-1.5 break-all">
            <span className="font-mono">{submittedEmail}</span> 으로 신청했어. 관리자가 승인하면
            로그인 가능해.
          </p>
          <p className="mt-2 text-xs text-emerald-700/80">
            ※ 승인 알림은 따로 안 가니, 잠시 뒤 로그인 페이지에서 다시 시도해줘.
          </p>
        </div>
        <Link
          href="/login"
          className="block w-full rounded-md bg-neutral-900 py-2.5 text-center text-sm font-medium text-white hover:bg-neutral-800"
        >
          로그인 페이지로
        </Link>
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

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">닉네임</span>
        <input
          type="text"
          name="name"
          required
          maxLength={30}
          autoComplete="nickname"
          placeholder="원하는 닉네임"
          disabled={pending}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
        />
        <span className="mt-1 block text-xs text-neutral-500">동료들에게 표시될 이름이야</span>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">비밀번호</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={pending}
          className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
        />
        <span className="mt-1 block text-xs text-neutral-500">8자 이상</span>
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-neutral-700">비밀번호 확인</span>
        <input
          type="password"
          name="password_confirm"
          required
          minLength={8}
          autoComplete="new-password"
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
        {pending ? '신청 중…' : '가입 신청'}
      </button>
    </form>
  );
}
