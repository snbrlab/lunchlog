import { RELEASES } from '@/lib/releases';

// D60: 릴리즈 노트 — git log --decorate --oneline 풍.
// 데이터는 src/lib/releases.ts 에 큐레이션. 새 항목은 배열 맨 앞에 추가.
export default function ReleasesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-fg">🏷️ 릴리즈 노트</h1>

      <ol className="mt-6 font-mono text-[13px]">
        {RELEASES.map((r, i) => {
          const isHead = i === 0;
          return (
            <li key={r.hash} className="relative">
              {/* branch 라인 */}
              <span
                aria-hidden
                className="absolute left-[5px] top-0 bottom-0 w-px bg-fg/15"
              />
              <div className="flex items-start gap-3 py-3">
                {/* 노드 점 */}
                <span
                  aria-hidden
                  className={`relative z-10 mt-1.5 inline-block h-[11px] w-[11px] shrink-0 rounded-full border-2 ${
                    isHead
                      ? 'border-amber-500 bg-amber-200'
                      : 'border-fg/50 bg-bg'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  {/* 한 줄 헤더: hash + 태그 + 날짜 + 제목 */}
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-mono text-[12px] text-amber-700">
                      {r.hash}
                    </span>
                    <span className="rounded-sm border border-amber-500 px-1.5 py-0 text-[10px] font-semibold text-amber-700">
                      {isHead ? `HEAD, tag: ${r.version}` : `tag: ${r.version}`}
                    </span>
                    <span className="text-[11px] text-fg-muted">{r.date}</span>
                    <span className="text-[13px] font-semibold text-fg">{r.title}</span>
                  </div>
                  {/* bullets */}
                  <ul className="mt-1.5 space-y-0.5 pl-1 text-[12px] text-fg-muted">
                    {r.bullets.map((b, j) => (
                      <li key={j} className="flex gap-2">
                        <span aria-hidden className="text-fg/30">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
