'use client';

// D78: 식당 중복 PR 열기 모달. RestaurantDetailPanel 에서 트리거.
// source 는 prop 으로 받고, target 은 client 가 검색해서 선택.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createPullRequest } from '@/lib/pull-requests/actions';

interface Props {
  sourceId: string;
  sourceName: string;
  onClose: () => void;
}

type TargetCandidate = { id: string; name: string };

export function OpenPullRequestModal({ sourceId, sourceName, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<TargetCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<TargetCandidate | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .neq('id', sourceId)
        .eq('is_closed', false)
        .order('name')
        .limit(500);
      if (cancelled) return;
      setCandidates((data ?? []) as TargetCandidate[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const filtered = query
    ? candidates.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  function submit() {
    if (!target) {
      alert('병합 대상 식당을 선택해주세요');
      return;
    }
    startTransition(async () => {
      const r = await createPullRequest({
        sourceId,
        targetId: target.id,
        reason: reason.trim() || null,
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      alert('PR 이 열렸어요! 관리자가 검토할 거예요 🙏');
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PR 열기"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-bg shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-fg">🔀 중복 식당 PR 열기</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-fg-muted hover:bg-fg/10 hover:text-fg"
          >
            ✕
          </button>
        </header>
        <div className="space-y-3 px-4 py-3">
          <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
            <span className="text-fg-muted">source (이 식당이 합쳐짐):</span>{' '}
            <span className="font-medium text-fg">{sourceName}</span>
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-fg">병합 대상 (target)</label>
            {target ? (
              <div className="flex items-center justify-between rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-xs">
                <span className="font-medium text-sky-900">{target.name}</span>
                <button
                  type="button"
                  onClick={() => setTarget(null)}
                  className="text-[11px] text-sky-700 underline-offset-2 hover:underline"
                >
                  변경
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="식당 이름 검색…"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
                />
                {filtered.length > 0 && (
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface p-1">
                    {filtered.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setTarget(c);
                            setQuery('');
                          }}
                          className="block w-full rounded px-2 py-1 text-left text-xs text-fg hover:bg-fg/5"
                        >
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-fg">
              사유 <span className="font-normal text-fg-muted">(선택)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="왜 중복이라고 생각하시나요?"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
            />
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-border bg-surface px-4 py-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !target}
            className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
          >
            {pending ? '제출 중…' : 'PR 열기'}
          </button>
        </footer>
      </div>
    </div>
  );
}
