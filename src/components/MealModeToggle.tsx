'use client';

import { useEffect, useState } from 'react';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';

// 점심 ☀ / 저녁 ☾ 토글. 슬라이드 인디케이터로 현재 모드 표시.
export function MealModeToggle() {
  const { mode, setMode } = useMealMode();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSR/hydration 시점에 mode 가 아직 sync 되기 전이라 placeholder 로 자리 잡고
  // mounted 후 실제 토글 표시 → mismatch 회피 (next-themes 패턴).
  if (!mounted) {
    return (
      <div
        aria-hidden
        className="inline-flex h-9 w-[7.5rem] rounded-full border border-border bg-surface sm:w-[10rem]"
      />
    );
  }

  return (
    <div
      role="group"
      aria-label="점심/저녁 모드"
      className="relative inline-flex h-9 items-center rounded-full border border-border bg-surface p-0.5 text-sm"
    >
      <span
        aria-hidden
        className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-fg transition-transform duration-300 ease-out ${
          mode === 'lunch' ? 'translate-x-0' : 'translate-x-[calc(100%+0px)]'
        }`}
      />
      <button
        type="button"
        onClick={() => setMode('lunch')}
        aria-pressed={mode === 'lunch'}
        className={`relative z-10 flex h-8 w-14 sm:w-20 items-center justify-center gap-1.5 rounded-full transition-colors ${
          mode === 'lunch' ? 'text-bg' : 'text-fg-muted'
        }`}
      >
        <span aria-hidden>☀</span>
        <span>점심</span>
      </button>
      <button
        type="button"
        onClick={() => setMode('dinner')}
        aria-pressed={mode === 'dinner'}
        className={`relative z-10 flex h-8 w-14 sm:w-20 items-center justify-center gap-1.5 rounded-full transition-colors ${
          mode === 'dinner' ? 'text-bg' : 'text-fg-muted'
        }`}
      >
        <span aria-hidden>☾</span>
        <span>저녁</span>
      </button>
    </div>
  );
}
