// D70: /u/[id] 등 남의 프로필 — 받은 뱃지 그리드 (잠긴 거 X).

import { BADGE_BY_CODE } from '@/lib/badges';

export function BadgeGrid({ codes }: { codes: string[] }) {
  const items = codes.map((c) => BADGE_BY_CODE.get(c)).filter((m) => !!m);
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-center text-xs text-fg-muted">
        아직 받은 뱃지가 없어요
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {items.map((m) => (
        <li
          key={m!.code}
          className="group relative flex flex-col items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-3 text-center"
        >
          <span aria-hidden className="text-2xl leading-none">{m!.emoji}</span>
          <span className="text-[11px] font-medium text-amber-900">{m!.label}</span>
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden w-44 -translate-x-1/2 rounded-md border border-border bg-bg px-2 py-1.5 text-[10px] font-normal leading-tight text-fg shadow-lg group-hover:block group-focus-within:block"
          >
            <span className="block font-semibold text-fg">{m!.label}</span>
            <span className="mt-0.5 block text-fg-muted">{m!.description}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
