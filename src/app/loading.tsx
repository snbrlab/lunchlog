// 루트 loading. 페이지 단위 로딩 시 스켈레톤 fallback.
export default function RootLoading() {
  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center px-6">
      <div className="flex items-center gap-2 text-xs text-fg-muted">
        <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-fg-muted" />
        로딩 중…
      </div>
    </main>
  );
}
