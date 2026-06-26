'use client';

// D70: /me Steam 도감 — axis 별 section, 받은 거 컬러, 잠긴 거 회색 ???.
// 상단에 대표 뱃지 선택 드롭다운 (/log row 에 노출됨).

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  BADGES,
  BADGE_BY_CODE,
  BADGE_SECTIONS,
  type BadgeMeta,
} from '@/lib/badges';
import { remainingTextFor, type BadgeProgress } from '@/lib/badges-progress';
import { setPrimaryBadge } from '@/app/(app)/me/actions';

interface Props {
  earnedCodes: string[];
  primaryCode: string | null;
  progress: BadgeProgress;
}

export function BadgeCollection({ earnedCodes, primaryCode, progress }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(false);
  const earnedSet = useMemo(() => new Set(earnedCodes), [earnedCodes]);
  const total = BADGES.length;
  const earnedCount = earnedCodes.length;

  function pick(code: string | null) {
    setPicker(false);
    startTransition(async () => {
      const r = await setPrimaryBadge(code);
      if (!r.ok) {
        alert(r.message);
        return;
      }
      router.refresh();
    });
  }

  const primaryMeta = primaryCode ? BADGE_BY_CODE.get(primaryCode) : null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-fg">
          🏆 뱃지{' '}
          <span className="text-fg-muted">
            ({earnedCount} / {total})
          </span>
        </h2>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-fg-muted">대표:</span>
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-0.5 text-fg transition hover:border-fg/40 disabled:opacity-50"
          >
            {primaryMeta ? (
              <>
                <span aria-hidden>{primaryMeta.emoji}</span>
                <span className="font-medium">{primaryMeta.label}</span>
              </>
            ) : (
              <span className="text-fg-muted">선택 없음</span>
            )}
            <span aria-hidden className="text-fg-muted">▾</span>
          </button>
        </div>
      </header>

      {picker && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-border bg-bg p-2">
          <button
            type="button"
            onClick={() => pick(null)}
            disabled={pending}
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-fg-muted hover:bg-fg/5"
          >
            🚫 표시 안 함
          </button>
          {earnedCodes.length === 0 ? (
            <p className="px-2 py-3 text-center text-[11px] text-fg-muted">
              받은 뱃지가 없어요
            </p>
          ) : (
            earnedCodes.map((c) => {
              const m = BADGE_BY_CODE.get(c);
              if (!m) return null;
              const active = c === primaryCode;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => pick(c)}
                  disabled={pending}
                  className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition ${
                    active ? 'bg-amber-100' : 'hover:bg-fg/5'
                  }`}
                >
                  <span aria-hidden className="text-base">{m.emoji}</span>
                  <span className="flex-1 font-medium text-fg">{m.label}</span>
                  <span className="text-[10px] text-fg-muted">{m.description}</span>
                </button>
              );
            })
          )}
        </div>
      )}

      <div className="mt-4 space-y-5">
        {BADGE_SECTIONS.map((section) => {
          const items = section.axes
            .flatMap((ax) => BADGES.filter((b) => b.axis === ax))
            .sort((a, b) => a.tier - b.tier);
          if (items.length === 0) return null;
          return (
            <div key={section.label}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
                {section.label}
              </h3>
              <ul className="flex flex-wrap gap-2">
                {items.map((m) => (
                  <BadgeCell
                    key={m.code}
                    meta={m}
                    owned={earnedSet.has(m.code)}
                    progress={progress}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BadgeCell({
  meta,
  owned,
  progress,
}: {
  meta: BadgeMeta;
  owned: boolean;
  progress: BadgeProgress;
}) {
  const remaining = remainingTextFor(meta, progress, owned);
  return (
    <li
      className={`group relative flex w-[88px] flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-center ${
        owned
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-border bg-fg/5 text-fg-muted/60'
      }`}
    >
      <button
        type="button"
        aria-label={owned ? meta.label : '잠긴 뱃지'}
        className="flex flex-col items-center gap-1 focus:outline-none"
      >
        <span
          aria-hidden
          className={`text-xl leading-none ${owned ? '' : 'grayscale opacity-40'}`}
        >
          {owned ? meta.emoji : '🔒'}
        </span>
        <span className="line-clamp-2 text-[10px] font-medium leading-tight">
          {owned ? meta.label : '???'}
        </span>
      </button>
      {/* hover/focus 시 설명 툴팁 */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-44 -translate-x-1/2 rounded-md border border-border bg-bg px-2 py-1.5 text-[10px] font-normal leading-tight text-fg shadow-lg group-hover:block group-focus-within:block"
      >
        <span className="block font-semibold text-fg">
          {owned ? meta.label : '🔒 잠긴 뱃지'}
        </span>
        <span className="mt-0.5 block text-fg-muted">{meta.description}</span>
        {remaining && (
          <span className="mt-1 block text-amber-700">⏳ {remaining}</span>
        )}
      </span>
    </li>
  );
}
