// D78: GitHub repo languages bar 스타일 — 사용자가 어떤 cuisine 그룹에 얼마나 commit 했는지 시각화.
// 각 commit 의 식당 첫 cuisine_type 의 그룹으로 분류 (ranking 페이지와 동일 규칙).

import { CUISINE_GROUP_META } from '@/lib/cuisine';

export interface CuisineSlice {
  label: string;
  emoji: string;
  color: string;
  count: number;
}

interface Props {
  slices: CuisineSlice[];
  total: number;
  // 0~total. 0 이면 작은 안내 메시지.
  caption?: string;
}

export function CuisineLanguageBar({ slices, total, caption }: Props) {
  if (total === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
        아직 commit 이 없어요. 한 줄 평을 남기면 어떤 음식을 좋아하는지 시각화돼요.
      </p>
    );
  }

  // 큰 순으로 정렬, 0 인 그룹은 제외
  const sorted = slices.filter((s) => s.count > 0).sort((a, b) => b.count - a.count);

  return (
    <div>
      {/* 막대 — segment 별 색 */}
      <div
        className="flex h-3 w-full overflow-hidden rounded-full border border-border bg-bg"
        role="img"
        aria-label="음식 분포 막대"
      >
        {sorted.map((s) => {
          const pct = (s.count / total) * 100;
          return (
            <div
              key={s.label}
              style={{ width: `${pct}%`, backgroundColor: s.color }}
              title={`${s.emoji} ${s.label} ${s.count}건 (${pct.toFixed(1)}%)`}
              aria-label={`${s.label} ${pct.toFixed(1)}퍼센트`}
            />
          );
        })}
      </div>
      {caption && <p className="mt-2 text-[11px] text-fg-muted">{caption}</p>}

      {/* 범례 — emoji + 그룹명 + 개수/퍼센트 */}
      <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
        {sorted.map((s) => {
          const pct = (s.count / total) * 100;
          return (
            <li key={s.label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-fg">
                <span aria-hidden className="mr-0.5">
                  {s.emoji}
                </span>
                {s.label}
              </span>
              <span className="text-fg-muted">
                {s.count} · {pct.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// 헬퍼 — cuisine value 목록 + cuisine_items lookup 으로 group 별 카운트 계산.
// reviews 의 restaurant.cuisine_types[0] 를 가져와서 호출.
export function buildCuisineSlices(
  primaryCuisineValues: (string | null | undefined)[],
  lookupGroup: (value: string) => string | undefined,
): { slices: CuisineSlice[]; total: number } {
  const counts = new Map<string, number>();
  for (const v of primaryCuisineValues) {
    if (!v) continue;
    const group = lookupGroup(v) ?? '기타';
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const slices: CuisineSlice[] = CUISINE_GROUP_META.map((m) => ({
    label: m.label,
    emoji: m.emoji,
    color: m.color,
    count: counts.get(m.label) ?? 0,
  }));
  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  return { slices, total };
}
