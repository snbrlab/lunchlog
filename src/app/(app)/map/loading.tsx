// /map 전용 로딩 스켈레톤. 사이드바 + 지도 영역 placeholder.
export default function MapLoading() {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="hidden h-full w-[280px] shrink-0 animate-pulse flex-col border-r border-border bg-surface lg:flex">
        <div className="border-b border-border px-4 py-3">
          <div className="h-3 w-24 rounded bg-fg/10" />
          <div className="mt-2 h-3 w-32 rounded bg-fg/10" />
        </div>
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded bg-fg/5" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 items-center justify-center bg-surface text-xs text-fg-muted">
        지도를 불러오는 중…
      </div>
    </div>
  );
}
