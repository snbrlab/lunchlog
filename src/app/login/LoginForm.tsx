'use client';

import { useState, useTransition } from 'react';
import {
  requestMagicLink,
  signInWithPassword,
  type RequestMagicLinkResult,
  type SignInWithPasswordResult,
} from './actions';

type Mode = 'password' | 'magiclink';

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>('password');
  const [pending, startTransition] = useTransition();
  const [pwError, setPwError] = useState<string | null>(null);
  const [mlResult, setMlResult] = useState<RequestMagicLinkResult | null>(null);

  function onPasswordSubmit(formData: FormData) {
    setPwError(null);
    startTransition(async () => {
      const r: SignInWithPasswordResult = await signInWithPassword(formData);
      // ok 시엔 server action 의 redirect 가 처리하므로 여기까진 ok=false 만 도달.
      if (!r.ok) setPwError(r.message);
    });
  }

  function onMagicLinkSubmit(formData: FormData) {
    setMlResult(null);
    startTransition(async () => {
      const r = await requestMagicLink(formData);
      setMlResult(r);
    });
  }

  if (mode === 'magiclink' && mlResult?.ok) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">
        <p className="font-medium">매직 링크를 보냈어!</p>
        <p className="mt-2 break-all">
          <span className="font-mono">{mlResult.email}</span> 메일함에서 링크를 클릭해줘.
        </p>
        <p className="mt-3 text-xs text-emerald-600">5분 안에 안 오면 스팸함도 한 번 확인.</p>
        <button
          type="button"
          onClick={() => {
            setMode('password');
            setMlResult(null);
          }}
          className="mt-3 text-xs text-emerald-700 underline"
        >
          비밀번호로 로그인하기
        </button>
      </div>
    );
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
              setMode('magiclink');
              setPwError(null);
            }}
            className="block w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            처음 가입하거나 비밀번호 잊었어? 매직링크 받기 (사내망)
          </button>
        </form>
      ) : (
        <form action={onMagicLinkSubmit} className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠️ 회사 메일은 사내망에서만 수신 가능. 외부망이라면 비밀번호로 로그인.
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

          {mlResult && !mlResult.ok && <p className="text-sm text-red-600">{mlResult.message}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-neutral-900 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {pending ? '보내는 중…' : '매직 링크 받기'}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('password');
              setMlResult(null);
            }}
            className="block w-full text-center text-xs text-neutral-500 underline-offset-2 hover:underline"
          >
            ← 비밀번호 로그인으로 돌아가기
          </button>
        </form>
      )}
    </div>
  );
}
