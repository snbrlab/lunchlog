'use client';

// 루트 에러 바운더리 — 어디서든 throw 시 fallback.
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('app error:', error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-3xl">😵</p>
        <h1 className="mt-4 text-base font-semibold text-fg">문제가 발생했어</h1>
        <p className="mt-1.5 text-xs text-fg-muted">
          {error.message || '알 수 없는 오류'}
          {error.digest && (
            <span className="mt-1 block font-mono text-[10px] opacity-60">#{error.digest}</span>
          )}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 rounded-md bg-fg px-4 py-2 text-sm font-medium text-bg transition hover:opacity-90"
        >
          다시 시도
        </button>
      </div>
    </main>
  );
}
