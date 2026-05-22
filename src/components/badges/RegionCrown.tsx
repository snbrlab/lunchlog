// D71: 지역 대장 표시 chip — 프로필 헤더 + /log row 등에서 재사용.

export interface RegionCrownItem {
  office_id: string;
  office_name: string;
  since_at?: string;
}

export function RegionCrowns({
  crowns,
  size = 'sm',
}: {
  crowns: RegionCrownItem[];
  size?: 'sm' | 'xs';
}) {
  if (crowns.length === 0) return null;
  const cls =
    size === 'xs'
      ? 'text-[10px] px-1 py-0 gap-0.5'
      : 'text-[11px] px-1.5 py-0.5 gap-1';
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {crowns.map((c) => (
        <span
          key={c.office_id}
          className={`inline-flex items-center rounded-full border border-rose-300 bg-rose-50 text-rose-800 ${cls}`}
          title={`${c.office_name} 식당 commit 1위`}
        >
          <span aria-hidden>👑</span>
          <span className="font-semibold">{c.office_name} 대장</span>
        </span>
      ))}
    </span>
  );
}
