'use client';

// D78/D80: PR 열기 모달. 두 종류 — 정보 수정 / 중복 병합.
// 첫 화면: kind 선택. 두번째 화면: 종류별 폼.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createPullRequest } from '@/lib/pull-requests/actions';
import {
  EDIT_FIELDS,
  buildEditPayload,
  fieldCurrentDisplay,
  fieldLabel,
  initialEditValue,
  type RestaurantSnapshot,
} from '@/lib/pull-requests/fields';
import type { EditField } from '@/types/db';

interface Props {
  restaurant: RestaurantSnapshot & { id: string };
  onClose: () => void;
}

type Step = 'choose' | 'edit' | 'merge';
type TargetCandidate = { id: string; name: string };

export function OpenPullRequestModal({ restaurant, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>('choose');
  const [reason, setReason] = useState('');

  // merge state
  const [candidates, setCandidates] = useState<TargetCandidate[]>([]);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<TargetCandidate | null>(null);

  // edit state
  const [field, setField] = useState<EditField>('name');
  const [editValue, setEditValue] = useState<string>('');

  // candidate fetch (merge 일 때만 사용 — 진입 시 미리 로드)
  useEffect(() => {
    if (step !== 'merge') return;
    if (candidates.length > 0) return;
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name')
        .neq('id', restaurant.id)
        .eq('is_closed', false)
        .order('name')
        .limit(500);
      if (cancelled) return;
      setCandidates((data ?? []) as TargetCandidate[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, restaurant.id, candidates.length]);

  // edit field 바뀔 때 입력값 초기화 — fields.ts 의 initialEditValue 위임
  function selectField(f: EditField) {
    setField(f);
    setEditValue(initialEditValue(f, restaurant));
  }

  function submitEdit() {
    const payload = buildEditPayload(field, editValue, restaurant);
    if (!payload) {
      alert('변경된 값이 없어요');
      return;
    }
    startTransition(async () => {
      const r = await createPullRequest({
        kind: 'edit',
        targetId: restaurant.id,
        editPayload: payload,
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

  function submitMerge() {
    if (!target) {
      alert('병합 대상 식당을 선택해주세요');
      return;
    }
    startTransition(async () => {
      const r = await createPullRequest({
        kind: 'merge',
        sourceId: restaurant.id,
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

  const filteredCandidates = query
    ? candidates.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

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
          <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
            {step !== 'choose' && (
              <button
                type="button"
                onClick={() => setStep('choose')}
                aria-label="뒤로"
                className="rounded p-0.5 text-fg-muted hover:bg-fg/10 hover:text-fg"
              >
                ←
              </button>
            )}
            {step === 'choose' ? '🔀 PR 열기' : step === 'edit' ? '✏️ 정보 수정' : '🔀 중복 병합'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1 text-fg-muted hover:bg-fg/10 hover:text-fg"
          >
            ✕
          </button>
        </header>

        {step === 'choose' && (
          <div className="space-y-2 px-4 py-4">
            <p className="mb-2 text-xs text-fg-muted">"{restaurant.name}" 에 대해 어떤 제안이세요?</p>
            <button
              type="button"
              onClick={() => {
                setStep('edit');
                selectField('name');
              }}
              className="block w-full rounded-lg border border-sky-300 bg-sky-50 p-4 text-left transition hover:border-sky-400"
            >
              <p className="text-sm font-semibold text-sky-900">✏️ 정보 수정</p>
              <p className="mt-0.5 text-[11px] text-sky-800/80">
                이름 / 가격대 / cuisine / 주소 / 술 가능 여부
              </p>
            </button>
            <button
              type="button"
              onClick={() => setStep('merge')}
              className="block w-full rounded-lg border border-border bg-surface p-3 text-left transition hover:border-fg/40"
            >
              <p className="text-sm font-semibold text-fg">🔀 중복 병합</p>
              <p className="mt-0.5 text-[11px] text-fg-muted">
                이 식당이 다른 식당과 중복이에요
              </p>
            </button>
          </div>
        )}

        {step === 'edit' && (
          <>
            <div className="space-y-3 px-4 py-3">
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-fg-muted">식당:</span>{' '}
                <span className="font-medium text-fg">{restaurant.name}</span>
              </p>

              <div>
                <label className="mb-1 block text-xs font-medium text-fg">어떤 정보?</label>
                <div className="flex flex-wrap gap-1.5">
                  {EDIT_FIELDS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => selectField(f)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                        field === f
                          ? 'border-fg bg-fg text-bg'
                          : 'border-border bg-bg text-fg-muted hover:bg-fg/5'
                      }`}
                    >
                      {fieldLabel(f)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-fg">
                  {fieldLabel(field)} 변경
                </label>
                <p className="mb-1 text-[10px] text-fg-muted">
                  현재: <span className="font-medium text-fg">{fieldCurrentDisplay(field, restaurant)}</span>
                </p>

                {field === 'name' && (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    maxLength={80}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
                  />
                )}
                {field === 'address' && (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    maxLength={200}
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
                  />
                )}
                {field === 'price_level' && (
                  <div className="flex gap-1.5">
                    {([1, 2, 3] as const).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setEditValue(String(n))}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          editValue === String(n)
                            ? 'border-fg bg-fg text-bg'
                            : 'border-border bg-bg text-fg-muted hover:bg-fg/5'
                        }`}
                      >
                        {'₩'.repeat(n)}
                      </button>
                    ))}
                  </div>
                )}
                {field === 'has_alcohol' && (
                  <div className="flex gap-1.5">
                    {([
                      { v: 'true', label: '🍺 가능' },
                      { v: 'false', label: '불가' },
                    ] as const).map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setEditValue(o.v)}
                        className={`rounded-md border px-3 py-1.5 text-xs transition ${
                          editValue === o.v
                            ? 'border-fg bg-fg text-bg'
                            : 'border-border bg-bg text-fg-muted hover:bg-fg/5'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {field === 'cuisine_types' && (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="칼국수, 소바, 라멘"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
                  />
                )}
                {field === 'kakao_place_url' && (
                  <>
                    <input
                      type="url"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="https://place.map.kakao.com/…"
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs outline-none focus:border-fg"
                    />
                    <p className="mt-1 text-[10px] text-fg-muted">
                      💡 카카오맵에서 해당 식당 검색 → 상세 페이지 URL 복사. *.kakao.com 도메인만 허용.
                    </p>
                  </>
                )}
                {field === 'categories' && (
                  <div className="flex gap-1.5">
                    {(
                      [
                        { v: 'lunch', label: '☀ 점심' },
                        { v: 'dinner', label: '🌙 저녁' },
                      ] as const
                    ).map((o) => {
                      const set = new Set(editValue.split(',').filter(Boolean));
                      const active = set.has(o.v);
                      return (
                        <button
                          key={o.v}
                          type="button"
                          onClick={() => {
                            if (active) set.delete(o.v);
                            else set.add(o.v);
                            // 정렬 (lunch 먼저)
                            const next = (['lunch', 'dinner'] as const).filter((c) => set.has(c));
                            setEditValue(next.join(','));
                          }}
                          className={`rounded-md border px-3 py-1.5 text-xs transition ${
                            active
                              ? 'border-fg bg-fg text-bg'
                              : 'border-border bg-bg text-fg-muted hover:bg-fg/5'
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
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
                  placeholder="어떤 근거로 수정하시나요?"
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
                onClick={submitEdit}
                disabled={pending}
                className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
              >
                {pending ? '제출 중…' : 'PR 열기'}
              </button>
            </footer>
          </>
        )}

        {step === 'merge' && (
          <>
            <div className="space-y-3 px-4 py-3">
              <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs">
                <span className="text-fg-muted">source (이 식당이 합쳐짐):</span>{' '}
                <span className="font-medium text-fg">{restaurant.name}</span>
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
                    {filteredCandidates.length > 0 && (
                      <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-border bg-surface p-1">
                        {filteredCandidates.map((c) => (
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
                onClick={submitMerge}
                disabled={pending || !target}
                className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
              >
                {pending ? '제출 중…' : 'PR 열기'}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
