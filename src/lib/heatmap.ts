// D52: ActivityHeatmap 용 일자 집계 헬퍼.
// server / client 양쪽에서 import 가능하도록 컴포넌트와 분리.

const TZ = 'Asia/Seoul';
const SHORT_FMT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

export function aggregateCounts(dates: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const iso of dates) {
    const day = SHORT_FMT.format(new Date(iso));
    map[day] = (map[day] ?? 0) + 1;
  }
  return map;
}
