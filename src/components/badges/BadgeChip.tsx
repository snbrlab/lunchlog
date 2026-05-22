// D70: 작은 뱃지 chip — /log row 등에서 한 개 표시용.

import { BADGE_BY_CODE } from '@/lib/badges';

export function BadgeChip({
  code,
  size = 'sm',
}: {
  code: string;
  size?: 'sm' | 'xs';
}) {
  const meta = BADGE_BY_CODE.get(code);
  if (!meta) return null;
  const cls =
    size === 'xs'
      ? 'text-[10px] px-1 py-0 gap-0.5'
      : 'text-[11px] px-1.5 py-0.5 gap-1';
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-50 text-amber-900 ${cls}`}
      title={`${meta.label} — ${meta.description}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span className="font-medium">{meta.label}</span>
    </span>
  );
}
