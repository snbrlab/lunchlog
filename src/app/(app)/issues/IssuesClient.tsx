'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { formatRelativeTime } from '@/lib/format-time';
import type { Office } from '@/types/db';
import type { IssueListItem } from '@/lib/issues/queries';
import { listIssues, openIssue } from '@/lib/issues/actions';
import { RestaurantPicker } from './RestaurantPicker';

type StatusTab = 'open' | 'closed';
type Target = 'restaurant' | 'region';

export default function IssuesClient({
  initialIssues,
  offices,
  currentUserId,
}: {
  initialIssues: IssueListItem[];
  offices: Office[];
  currentUserId: string;
}) {
  const [status, setStatus] = useState<StatusTab>('open');
  const [office, setOffice] = useState('all');
  const [issues, setIssues] = useState<IssueListItem[]>(initialIssues);
  const [pending, start] = useTransition();
  const [composing, setComposing] = useState(false);

  function refetch(nextStatus: StatusTab, nextOffice: string) {
    setStatus(nextStatus);
    setOffice(nextOffice);
    start(async () => setIssues(await listIssues(nextStatus, nextOffice)));
  }

  return (
    <div className="space-y-4">
      {/* 상단 바 — 상태 탭 + new */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['open', 'closed'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => refetch(s, office)}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition ${
                s === status
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border bg-surface text-fg-muted hover:border-fg/40'
              }`}
            >
              {s === 'open' ? '🟢 Open' : '🟣 Closed'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setComposing((v) => !v)}
          className="rounded-md border border-emerald-400 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
        >
          {composing ? '닫기' : '+ new issue'}
        </button>
      </div>

      {composing && (
        <NewIssueForm
          offices={offices}
          onOpened={() => {
            setComposing(false);
            refetch('open', office);
          }}
        />
      )}

      {/* 지역 필터 */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[10px] text-fg-muted">지역</span>
        {[{ id: 'all', name: '전체' }, ...offices, { id: 'none', name: '미지정' }].map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => refetch(status, o.id)}
            className={`rounded-full px-2 py-0.5 text-[11px] transition ${
              office === o.id ? 'bg-fg text-bg' : 'bg-fg/5 text-fg-muted hover:bg-fg/10'
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>

      {/* 리스트 */}
      <ol className="overflow-hidden rounded-lg border border-border bg-surface">
        {pending && (
          <li className="px-4 py-10 text-center text-sm text-fg-muted">불러오는 중…</li>
        )}
        {!pending && issues.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-fg-muted">
            {status === 'open' ? '열린 이슈가 없어요. 첫 질문을 남겨보세요!' : '닫힌 이슈가 없어요'}
          </li>
        )}
        {!pending &&
          issues.map((it) => (
            <li key={it.id} className="border-b border-border last:border-b-0">
              <Link
                href={`/issues/${it.id}`}
                className="flex flex-col gap-1 px-4 py-3 transition hover:bg-fg/[0.02]"
              >
                <div className="flex items-start gap-2">
                  <span aria-hidden className="text-sm leading-5">
                    {it.status === 'open' ? '🟢' : '🟣'}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-fg">{it.body}</span>
                  <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                    #{it.issue_number}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pl-6 text-[11px] text-fg-muted">
                  <span>@{it.author?.name ?? '익명'}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(new Date(it.created_at))}</span>
                  {it.office_name && (
                    <span className="rounded bg-fg/5 px-1.5 py-0.5">🏷 {it.office_name}</span>
                  )}
                  {it.restaurant_name && (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                      👉 {it.restaurant_name}
                    </span>
                  )}
                  {it.status === 'closed' && it.resolved_restaurant_name && (
                    <span className="text-fg-muted">→ {it.resolved_restaurant_name} 로 해결</span>
                  )}
                  <span className="ml-auto">💬 {it.comment_count}</span>
                </div>
              </Link>
            </li>
          ))}
      </ol>
    </div>
  );
}

function NewIssueForm({ offices, onOpened }: { offices: Office[]; onOpened: () => void }) {
  const [target, setTarget] = useState<Target>('restaurant');
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [officeId, setOfficeId] = useState<string>(offices[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!body.trim()) return setError('무엇이 궁금한지 적어주세요');
    if (target === 'restaurant' && !restaurant) return setError('식당을 골라주세요');
    start(async () => {
      const r = await openIssue({
        body,
        restaurantId: target === 'restaurant' ? restaurant!.id : null,
        officeId: target === 'region' ? officeId : null,
      });
      if (!r.ok) return setError(r.message);
      setBody('');
      setRestaurant(null);
      onOpened();
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex gap-2 text-xs">
        {(['restaurant', 'region'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTarget(t)}
            className={`rounded-md border px-2.5 py-1.5 transition ${
              t === target ? 'border-fg bg-fg text-bg' : 'border-border text-fg-muted hover:border-fg/40'
            }`}
          >
            {t === 'restaurant' ? '🍽 특정 식당' : '📍 지역'}
          </button>
        ))}
      </div>

      {target === 'restaurant' ? (
        <RestaurantPicker value={restaurant} onChange={setRestaurant} />
      ) : (
        <select
          value={officeId}
          onChange={(e) => setOfficeId(e.target.value)}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs outline-none focus:border-fg"
        >
          {offices.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={
          target === 'restaurant' ? '지나가다 봤는데 여기 어때요?' : '마곡 근처 평양냉면 맛집 추천해주세요!'
        }
        className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-fg"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-md bg-fg px-4 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '여는 중…' : '이슈 열기'}
        </button>
      </div>
    </div>
  );
}
