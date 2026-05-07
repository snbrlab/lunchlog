'use client';

import { useState, useTransition } from 'react';
import {
  requestOtp,
  verifyOtp,
  type RequestOtpResult,
  type VerifyOtpResult,
} from './actions';

type Step = 'email' | 'code';

export default function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('email');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onRequestSubmit(formData: FormData) {
    setError(null);
    const email = String(formData.get('email') ?? '').trim().toLowerCase();
    startTransition(async () => {
      const r: RequestOtpResult = await requestOtp(formData);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setSubmittedEmail(email);
      setStep('code');
    });
  }

  function onVerifySubmit(formData: FormData) {
    setError(null);
    formData.set('email', submittedEmail);
    startTransition(async () => {
      const r: VerifyOtpResult = await verifyOtp(formData);
      if (!r.ok) setError(r.message);
    });
  }

  function onResend() {
    if (!submittedEmail) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('email', submittedEmail);
      const r = await requestOtp(fd);
      if (!r.ok) setError(r.message);
    });
  }

  if (step === 'code') {
    return (
      <form action={onVerifySubmit} className="space-y-4">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-medium">메일 발송 완료!</p>
          <p className="mt-1 break-all">
            <span className="font-mono">{submittedEmail}</span> 메일함에서 인증 코드를 확인해주세요.
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-neutral-700">인증 코드</span>
          <input
            type="text"
            name="token"
            required
            autoFocus
            inputMode="numeric"
            pattern="\d{6,10}"
            maxLength={10}
            autoComplete="one-time-code"
            placeholder="메일에 적힌 숫자 코드"
            disabled={pending}
            className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {pending ? '확인 중…' : '인증하고 비번 재설정'}
        </button>

        <div className="flex justify-between text-xs text-neutral-500">
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setError(null);
            }}
            className="underline-offset-2 hover:underline"
          >
            ← 이메일 다시 입력
          </button>
          <button
            type="button"
            onClick={onResend}
            disabled={pending}
            className="underline-offset-2 hover:underline disabled:opacity-50"
          >
            코드 재전송
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={onRequestSubmit} className="space-y-4">
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
        {pending ? '메일 보내는 중…' : '인증 코드 받기'}
      </button>
    </form>
  );
}
