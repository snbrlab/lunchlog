// D52: GitHub 잔디 스타일 활동 히트맵.
// counts: 'YYYY-MM-DD' (KST) → 그날의 commit 수
// 7 (요일) × 53 (주) 그리드. 가로 스크롤 (모바일 친화).

interface Props {
  counts: Record<string, number>;
}

const WEEKS = 53;
const TZ = 'Asia/Seoul';

const SHORT_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

function ymdKst(d: Date): string {
  return SHORT_FMT.format(d);
}

function colorClass(count: number): string {
  if (count === 0) return 'bg-fg/5';
  if (count <= 2) return 'bg-amber-200';
  if (count <= 5) return 'bg-amber-400';
  if (count <= 9) return 'bg-amber-500';
  return 'bg-amber-700';
}

const KST_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function kstWeekday(date: Date): number {
  // KST 기준 요일 (0=일~6=토). Intl 로 계산
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

export function ActivityHeatmap({ counts }: Props) {
  const todayKstStr = ymdKst(new Date());
  // KST 자정 기준 Date (UTC+9)
  const todayKst = new Date(todayKstStr + 'T00:00:00+09:00');

  // 53주 × 7일 = 371 cells. 마지막은 today.
  const days: { date: string; count: number }[] = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(todayKst);
    d.setDate(d.getDate() - i);
    const ds = ymdKst(d);
    days.push({ date: ds, count: counts[ds] ?? 0 });
  }

  // 첫 셀의 요일에 따라 leading null 채우기
  const firstDate = new Date(days[0]!.date + 'T00:00:00+09:00');
  const firstWeekday = kstWeekday(firstDate);

  type Cell = { date: string; count: number } | null;
  const weeks: Cell[][] = [];
  let week: Cell[] = new Array(firstWeekday).fill(null);
  for (const d of days) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const total = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-[3px]">
          {/* 요일 라벨 (월/수/금) */}
          <div className="flex flex-col gap-[3px] pr-1 text-[9px] text-fg-muted/70">
            {KST_DAY_NAMES.map((d, i) => (
              <span key={d} className="h-[12px] leading-[12px]">
                {i % 2 === 1 ? d : ''}
              </span>
            ))}
          </div>
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {w.map((cell, j) => (
                <div
                  key={j}
                  title={cell ? `${cell.date} · commit ${cell.count}` : ''}
                  className={`h-[12px] w-[12px] rounded-sm ${cell ? colorClass(cell.count) : 'bg-transparent'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-fg-muted">
        <span>
          지난 1년 · 총 {total} commit · {activeDays}일 활동
        </span>
        <span className="flex items-center gap-1">
          적음
          <span className="h-[10px] w-[10px] rounded-sm bg-fg/5" />
          <span className="h-[10px] w-[10px] rounded-sm bg-amber-200" />
          <span className="h-[10px] w-[10px] rounded-sm bg-amber-400" />
          <span className="h-[10px] w-[10px] rounded-sm bg-amber-500" />
          <span className="h-[10px] w-[10px] rounded-sm bg-amber-700" />
          많음
        </span>
      </div>
    </div>
  );
}

// helper for /me, /u 에서 reviews dates 를 counts 맵으로 집계
export function aggregateCounts(dates: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const iso of dates) {
    const day = SHORT_FMT.format(new Date(iso));
    map[day] = (map[day] ?? 0) + 1;
  }
  return map;
}
