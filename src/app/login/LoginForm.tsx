'use client';

import { useState, useTransition } from 'react';
import {
  requestOtp,
  signInWithPassword,
  verifyOtp,
  type RequestOtpResult,
  type SignInWithPasswordResult,
  type VerifyOtpResult,
} from './actions';

type Mode = 'password' | 'otp';
type OtpStep = 'email' | 'code';

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [pending, startTransition] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);

  // OTP 단계 state
  const [otpStep, setOtpStep] = useState<OtpStep>('email');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  function onPasswordSubmit(formData: FormData) {
    setPwError(null);
    startTransition(async () => {
      const r: SignInWithPasswordResult = await signInWithPassword(formData);
      if (!r.ok) setPwError(r.message);
    });
  }

  function onOtpRequestSubmit(formData: FormData) {
    setOtpError(null);
    startTransition(async () => {
      const r: RequestOtpResult = await requestOtp(formData);
      if (!r.ok) {
        setOtpError(r.message);
        return;
      }
      setOtpEmail(r.email);
      setOtpStep('code');
    });
  }

  function onOtpVerifySubmit(formData: FormData) {
    setOtpError(null);
    formData.set('email', otpEmail);
    startTransition(async () => {
      const r: VerifyOtpResult = await verifyOtp(formData);
      if (!r.ok) setOtpError(r.message);
    });
  }

  function onResendOtp() {
    if (!otpEmail) return;
    setOtpError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('email', otpEmail);
      const r = await requestOtp(formData);
      if (!r.ok) setOtpError(r.message);
    });
  }

  return (
    <div className="space-y-5">
      {mode === 'password' ? (
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

          <button
            type="button"
            onClick={() => {
              setMode('otp');
              setOtpStep('email');
              setOtpError(null);
              setPwError(null);
            }}
            className="block w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            이메일 인증 코드로 로그인 / 회원가입
          </button>
        </form>
      ) : otpStep === 'email' ? (
        <form action={onOtpRequestSubmit} className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            메일에 8자리 코드가 발송돼. 코드를 입력하면 로그인 끝.
          </div>
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
          {otpError && <p className="text-sm text-red-600">{otpError}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? '보내는 중…' : '인증 코드 받기'}
          </button>
          <button
            type="button"
            onClick={() => setMode('password')}
            className="block w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            ← 비밀번호 로그인으로 돌아가기
          </button>
        </form>
      ) : (
        <form action={onOtpVerifySubmit} className="space-y-4">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-medium">메일 발송 완료!</p>
            <p className="mt-1 break-all">
              <span className="font-mono">{otpEmail}</span> 메일함에서 8자리 코드 확인.
            </p>
          </div>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-neutral-700">8자리 코드</span>
            <input
              type="text"
              name="token"
              required
              autoFocus
              inputMode="numeric"
              pattern="\d{8}"
              maxLength={8}
              autoComplete="one-time-code"
              placeholder="00000000"
              disabled={pending}
              className="w-full rounded-md border border-neutral-300 px-3 py-2.5 text-center font-mono text-lg tracking-widest outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 disabled:bg-neutral-50"
            />
          </label>
          {otpError && <p className="text-sm text-red-600">{otpError}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? '확인 중…' : '인증하고 로그인'}
          </button>
          <div className="flex justify-between text-xs text-neutral-500">
            <button
              type="button"
              onClick={() => {
                setOtpStep('email');
                setOtpError(null);
              }}
              className="underline-offset-2 hover:underline"
            >
              ← 이메일 다시 입력
            </button>
            <button
              type="button"
              onClick={onResendOtp}
              disabled={pending}
              className="underline-offset-2 hover:underline disabled:opacity-50"
            >
              코드 재전송
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
