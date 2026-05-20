'use client';

// D69: 제보 댓글 스레드 — /report (사용자) / /admin/reports (admin) 공용.
// chat 스타일 + ping-pong 룰 (내 차례일 때만 input 활성).

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { addReportComment } from '@/lib/reports/comment-actions';
import { formatRelativeTime } from '@/lib/format-time';

export interface ReportMeta {
  id: string;
  message: string;
  created_at: string;
  category: 'bug' | 'feature' | 'restaurant' | 'other';
  author: { id: string; name: string | null } | null; // 원 작성자 (사용자)
}

export interface CommentEntry {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  author: {
    id: string | null;
    name: string | null;
    role: 'member' | 'admin' | null;
  } | null;
}

interface Props {
  report: ReportMeta;
  comments: CommentEntry[];
  currentUserId: string;
  isAdmin: boolean;
  status: 'open' | 'reviewing' | 'resolved';
  maxBody?: number;
}

const MAX_DEFAULT = 2000;

export function ReportThread({
  report,
  comments,
  currentUserId,
  isAdmin,
  status,
  maxBody = MAX_DEFAULT,
}: Props) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 직전 게시자가 누구냐 + 내 차례냐. 단 resolved 면 양쪽 잠금.
  const { canPost, hint } = useMemo(() => {
    if (status === 'resolved') {
      return {
        canPost: false,
        hint: isAdmin
          ? '처리 완료된 제보예요. 다시 얘기하려면 상태를 "확인중" 으로 바꾸세요'
          : '처리 완료된 제보예요',
      };
    }
    const last = comments[comments.length - 1];
    if (!last) {
      // 댓글 0 → 본문 = 사용자. admin 차례.
      if (isAdmin) return { canPost: true, hint: '관리자 첫 답글을 보내세요' };
      return {
        canPost: false,
        hint: '관리자 응답을 기다리는 중',
      };
    }
    if (last.author_id === currentUserId) {
      return { canPost: false, hint: '상대 응답을 기다리는 중' };
    }
    return { canPost: true, hint: '내 차례 — 답글을 작성하세요' };
  }, [comments, currentUserId, isAdmin, status]);

  function submit() {
    if (!canPost || !body.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await addReportComment(report.id, body);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setBody('');
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {/* 원본 제보 본문 — reporter 의 첫 메시지로 표시 */}
        <Bubble
          mine={report.author?.id === currentUserId}
          authorName={report.author?.name ?? '사용자'}
          role={null}
          body={report.message}
          at={report.created_at}
        />
        {comments.map((c) => (
          <Bubble
            key={c.id}
            mine={c.author_id === currentUserId}
            authorName={c.author?.name ?? '(탈퇴)'}
            role={c.author?.role ?? null}
            body={c.body}
            at={c.created_at}
          />
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-bg p-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={maxBody}
          disabled={!canPost || pending}
          placeholder={canPost ? '답글 작성…' : hint}
          className="w-full resize-none rounded bg-transparent px-2 py-1.5 text-sm outline-none disabled:opacity-50"
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-fg-muted">{hint}</span>
          <div className="flex items-center gap-2">
            <span className="text-fg-muted/60">
              {body.length}/{maxBody}
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canPost || pending || !body.trim()}
              className="rounded bg-fg px-3 py-1 text-xs font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
            >
              {pending ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </div>
        {error && <p className="mt-1 text-[11px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}

function Bubble({
  mine,
  authorName,
  role,
  body,
  at,
}: {
  mine: boolean;
  authorName: string;
  role: 'member' | 'admin' | null;
  body: string;
  at: string;
}) {
  return (
    <li className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          mine
            ? 'bg-fg text-bg'
            : role === 'admin'
              ? 'border border-amber-300 bg-amber-50 text-amber-900'
              : 'border border-border bg-surface text-fg'
        }`}
      >
        <div
          className={`flex items-center gap-1.5 text-[10px] ${
            mine ? 'text-bg/70' : 'text-fg-muted'
          }`}
        >
          <span className="font-semibold">{authorName}</span>
          {role === 'admin' && !mine && (
            <span className="rounded bg-amber-200 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">
              admin
            </span>
          )}
          <span>·</span>
          <span>{formatRelativeTime(new Date(at))}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words">{body}</p>
      </div>
    </li>
  );
}
