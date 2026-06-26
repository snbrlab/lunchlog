// D80: 뱃지 진행도 — badge_progress(uid) RPC 응답 타입 + 남은 횟수 계산 헬퍼.

import type { BadgeMeta } from '@/lib/badges';

export interface BadgeProgress {
  commits: number;
  streak: number;
  pioneer: number;
  cuisines: number;
  lunch: number;
  dinner: number;
  total: number;
  cuisine_per_group: Record<string, number>;
}

export const EMPTY_PROGRESS: BadgeProgress = {
  commits: 0,
  streak: 0,
  pioneer: 0,
  cuisines: 0,
  lunch: 0,
  dinner: 0,
  total: 0,
  cuisine_per_group: {},
};

// meta.axis 기반으로 진행도/남은 횟수 문자열 반환.
// 이미 받은 거(owned=true) 면 null — 호출 측에서 안 보여줘도 됨.
export function remainingTextFor(
  meta: BadgeMeta,
  progress: BadgeProgress,
  owned: boolean,
): string | null {
  if (owned) return null;
  const t = meta.threshold;

  if (meta.axis === 'commits') return makeNeedText(t - progress.commits, meta.unit);
  if (meta.axis === 'streak') return makeNeedText(t - progress.streak, meta.unit);
  if (meta.axis === 'pioneer') return makeNeedText(t - progress.pioneer, meta.unit);
  if (meta.axis === 'cuisines') return makeNeedText(t - progress.cuisines, meta.unit);

  // 시간대 — 비율 기반. 전체 20+ 가 사전조건.
  if (meta.axis === 'time_lunch' || meta.axis === 'time_dinner') {
    const part = meta.axis === 'time_lunch' ? progress.lunch : progress.dinner;
    if (progress.total < 20) {
      const left = 20 - progress.total;
      return `commit ${left}개 더 + ${meta.threshold}% 비중 유지`;
    }
    const pct = progress.total > 0 ? Math.round((part / progress.total) * 100) : 0;
    if (pct >= meta.threshold) return '비중은 충분 — 곧 자동 지급!';
    return `현재 ${pct}% (${meta.threshold}% 필요)`;
  }

  // cuisine 특화: axis = 'cuisine_<group>' 형태
  if (meta.axis.startsWith('cuisine_')) {
    const group = meta.axis.slice('cuisine_'.length);
    const cur = progress.cuisine_per_group[group] ?? 0;
    return makeNeedText(t - cur, meta.unit);
  }

  return null;
}

function makeNeedText(need: number, unit: string): string {
  if (need <= 0) return '곧 자동 지급!';
  return `${need}${unit} 더 필요`;
}
