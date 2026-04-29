'use client';

import { useState, useTransition } from 'react';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import { generateCommitHash } from '@/lib/hash';
import { createReview } from '@/lib/reviews/actions';
import type { MealMode } from '@/types/db';

// 부모에 group 클래스 박혀있을 때 hover 시 위에 띄우는 작은 라벨.
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[10px] font-medium text-bg opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100"
    >
      {children}
    </span>
  );
}

const MAX = 200;

interface Props {
  restaurantId: string;
  onCreated: () => void;
}

export function ReviewComposer({ restaurantId, onCreated }: Props) {
  const { mode } = useMealMode();
  const [message, setMessage] = useState('');
  const [mealTime, setMealTime] = useState<MealMode>(mode);
  const [partySize, setPartySize] = useState<string>(''); // 빈 문자열 = 안 적음
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 사용자가 명시적 토글 안 했을 때 점심/저녁 모드 변경에 따라가도록 — 명시적 변경 후엔 고정.
  const [touched, setTouched] = useState(false);
  if (!touched && mealTime !== mode) setMealTime(mode);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) return;
    if (trimmed.length > MAX) {
      setError(`${MAX}자 이내`);
      return;
    }
    let parsedSize: number | null = null;
    if (partySize.trim()) {
      const n = Number(partySize);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        setError('인원수는 1~99 사이');
        return;
      }
      parsedSize = n;
    }
    const hash = generateCommitHash();
    startTransition(async () => {
      const r = await createReview({
        restaurantId,
        message: trimmed,
        mealTime,
        partySize: parsedSize,
        hash,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setMessage('');
      setPartySize('');
      onCreated();
    });
  }

  const remaining = MAX - message.length;

  return (
    <form
      onSubmit={onSubmit}
      className="flex shrink-0 items-stretch gap-2 border-t border-border bg-bg px-5 py-2.5 max-lg:pb-[max(env(safe-area-inset-bottom),0.625rem)]"
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="한 줄 리뷰…"
        maxLength={MAX}
        disabled={pending}
        className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 outline-none transition focus:border-fg disabled:opacity-50"
        aria-label="리뷰 메시지"
      />

      {/* 방문 인원 (선택) */}
      <div className="group relative">
        <Tooltip>몇명이서 갔는지 (선택)</Tooltip>
        <span
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm"
        >
          👥
        </span>
        <input
          type="number"
          min={1}
          max={99}
          step={1}
          inputMode="numeric"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          placeholder="N"
          disabled={pending}
          aria-label="방문 인원 (선택)"
          className="h-9 w-14 rounded-md border border-border bg-surface pl-6 pr-1.5 text-sm text-fg placeholder:text-fg-muted/60 outline-none transition focus:border-fg disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      <div className="group relative">
        <Tooltip>{mealTime === 'lunch' ? '점심으로 작성' : '저녁으로 작성'} (클릭으로 전환)</Tooltip>
        <button
          type="button"
          onClick={() => {
            setMealTime((m) => (m === 'lunch' ? 'dinner' : 'lunch'));
            setTouched(true);
          }}
          disabled={pending}
          aria-label={mealTime === 'lunch' ? '점심으로 작성' : '저녁으로 작성'}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-base hover:bg-fg/5 disabled:opacity-50"
        >
          {mealTime === 'lunch' ? '☀' : '☾'}
        </button>
      </div>

      <div className="group relative">
        <Tooltip>한 줄 리뷰 등록 (Enter)</Tooltip>
        <button
          type="submit"
          disabled={pending || !message.trim()}
          className="h-9 rounded-md bg-fg px-3 text-xs font-semibold uppercase tracking-wider text-bg transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? '…' : 'commit'}
        </button>
      </div>

      {error && (
        <p className="absolute -translate-y-7 text-xs text-red-500">{error}</p>
      )}
      <p className="absolute -translate-y-5 right-5 text-[10px] text-fg-muted/60">
        {remaining}자 남음
      </p>
    </form>
  );
}
