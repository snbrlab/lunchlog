'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { formatRelativeTime } from '@/lib/format-time';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import type { IssueComment, IssueDetail } from '@/lib/issues/queries';
import { answerIssue, closeIssue } from '@/lib/issues/actions';
import { RestaurantPicker } from '../RestaurantPicker';
import { MentionTextarea } from '../MentionTextarea';

export default function IssueThread({
  issue,
  canClose,
}: {
  issue: IssueDetail;
  canClose: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              issue.status === 'open'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-purple-100 text-purple-800'
            }`}
          >
            {issue.status === 'open' ? '🟢 Open' : '🟣 Closed'}
          </span>
          <span className="font-mono text-xs text-fg-muted">#{issue.issue_number}</span>
        </div>
        <p className="mt-2 text-lg text-fg">{issue.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
          <span>@{issue.author?.name ?? '익명'}</span>
          <span>·</span>
          <span>{formatRelativeTime(new Date(issue.created_at))}</span>
          {issue.office_name && (
            <span className="rounded bg-fg/5 px-1.5 py-0.5">🏷 {issue.office_name}</span>
          )}
          {issue.restaurant_id && issue.restaurant_name && (
            <a
              href={`/map?focus=${issue.restaurant_id}`}
              className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 hover:underline"
            >
              👉 {issue.restaurant_name}
            </a>
          )}
          {!issue.restaurant_id && issue.external_name && issue.external_url && (
            <a
              href={issue.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700 hover:underline"
            >
              🔗 {issue.external_name} (카카오맵)
            </a>
          )}
        </div>
        {issue.status === 'closed' && issue.resolved_restaurant_name && (
          <p className="mt-2 text-xs text-fg-muted">
            ✅ <span className="font-medium text-fg">{issue.resolved_restaurant_name}</span> 로 해결됨
          </p>
        )}
      </div>

      {/* 답변 스레드 */}
      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-xs font-medium text-fg-muted">💬 answers ({issue.comments.length})</p>
        {issue.comments.length === 0 && (
          <p className="py-4 text-center text-xs text-fg-muted/70">
            아직 답변이 없어요. 아는 곳이면 알려주세요!
          </p>
        )}
        {issue.comments.map((c) => (
          <AnswerRow key={c.id} c={c} />
        ))}
      </div>

      {/* 답변 작성 */}
      {issue.status === 'open' ? (
        <AnswerForm
          issueId={issue.id}
          onDone={() => router.refresh()}
        />
      ) : (
        <p className="rounded-md border border-border bg-fg/[0.02] px-4 py-3 text-center text-xs text-fg-muted">
          닫힌 이슈예요.
        </p>
      )}

      {/* 닫기 */}
      {canClose && issue.status === 'open' && (
        <CloseControl
          issueId={issue.id}
          onClosed={() => router.refresh()}
          pendingOuter={pending}
          start={start}
        />
      )}
    </div>
  );
}

function AnswerRow({ c }: { c: IssueComment }) {
  const name = c.author?.name ?? '(알수없음)';
  const emoji = resolveAvatarEmoji(c.author?.avatar_emoji, name + (c.author?.id ?? ''));
  return (
    <div className="flex gap-2">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
        style={{ backgroundColor: c.author?.avatar_color ?? '#fde68a' }}
      >
        {emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span className="font-medium text-fg">{name}</span>
          <span>·</span>
          <span>{formatRelativeTime(new Date(c.created_at))}</span>
        </div>
        <p className="mt-0.5 text-sm text-fg">{c.body}</p>
        {c.restaurant_id && c.restaurant_name && (
          <a
            href={`/map?focus=${c.restaurant_id}`}
            className="mt-1 inline-block rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-100"
          >
            👉 {c.restaurant_name}
          </a>
        )}
      </div>
    </div>
  );
}

function AnswerForm({ issueId, onDone }: { issueId: string; onDone: () => void }) {
  const [body, setBody] = useState('');
  const [restaurant, setRestaurant] = useState<{ id: string; name: string } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    if (!body.trim()) return setError('답변을 입력해주세요');
    start(async () => {
      const r = await answerIssue({ issueId, body, restaurantId: restaurant?.id ?? null });
      if (!r.ok) return setError(r.message);
      setBody('');
      setRestaurant(null);
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
      <MentionTextarea
        value={body}
        onChange={setBody}
        rows={2}
        maxLength={2000}
        placeholder="답변 남기기 (@닉네임 으로 멘션 가능)"
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          <span>👉 추천 식당</span>
          <RestaurantPicker value={restaurant} onChange={setRestaurant} placeholder="첨부 (선택)" />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="shrink-0 rounded-md bg-fg px-4 py-1.5 text-xs font-medium text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '…' : '답변하기'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function CloseControl({
  issueId,
  onClosed,
  pendingOuter,
  start,
}: {
  issueId: string;
  onClosed: () => void;
  pendingOuter: boolean;
  start: (fn: () => void) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [resolved, setResolved] = useState<{ id: string; name: string } | null>(null);

  function doClose() {
    start(async () => {
      const r = await closeIssue({ issueId, resolvedRestaurantId: resolved?.id ?? null });
      if (r.ok) onClosed();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {picking ? (
        <>
          <span className="text-[11px] text-fg-muted">해결한 식당 (선택):</span>
          <RestaurantPicker value={resolved} onChange={setResolved} placeholder="식당 검색…" />
          <button
            type="button"
            onClick={doClose}
            disabled={pendingOuter}
            className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
          >
            {pendingOuter ? '…' : '이슈 닫기'}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:border-purple-400 hover:text-purple-700"
        >
          🟣 이슈 닫기
        </button>
      )}
    </div>
  );
}
