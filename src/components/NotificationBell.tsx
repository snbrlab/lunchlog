'use client';

// D74: 헤더 🔔 알림 dropdown. 미확인 + 최근 읽음 모두 모아서 볼 수 있음.
// NotificationToast 는 page load 시 새로 도착한 거 보여주는 in-session 토스트로 유지.
// 이건 모아보기 용도.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  BadgeEarnedPayload,
  MentionPayload,
  NotificationRow,
  PullRequestNewPayload,
  PullRequestResolvedPayload,
  RegionChampionPayload,
  ReportCommentPayload,
  ReportNewPayload,
  ReportUpdatePayload,
  ReviewReplyPayload,
  IssueAnswerPayload,
  IssueMentionPayload,
} from '@/types/db';
import { BADGE_BY_CODE } from '@/lib/badges';

const LIST_LIMIT = 20;

const STATUS_LABEL: Record<string, string> = {
  open: '접수',
  reviewing: '확인중',
  resolved: '완료',
};

const CATEGORY_LABEL: Record<string, string> = {
  bug: '🐞 버그',
  feature: '💡 기능',
  restaurant: '🍽️ 식당',
  other: '💬 기타',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 미확인 카운트는 따로 가볍게 polling
  const unreadCount = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT);
      if (cancelled) return;
      setItems((data ?? []) as NotificationRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    const unread = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length === 0) return;
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.from('notifications').update({ read_at: now }).in('id', unread);
    setLoading(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`알림 ${unreadCount > 0 ? `(미확인 ${unreadCount}건)` : ''}`}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-base transition hover:bg-fg/5"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="알림 목록"
          className="fixed right-2 top-[3.5rem] z-50 mt-1 w-[min(360px,calc(100vw-1rem))] max-h-[70vh] overflow-hidden rounded-lg border border-border bg-bg shadow-xl ring-1 ring-black/5"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold text-fg">알림</p>
            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || unreadCount === 0}
              className="text-[10px] text-fg-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-40 disabled:no-underline"
            >
              전체 읽음
            </button>
          </header>

          <div className="max-h-[calc(70vh-2.25rem)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-fg-muted">알림이 없어요</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotificationItem
                      note={n}
                      onClick={() => {
                        markRead(n.id);
                        setOpen(false);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ note, onClick }: { note: NotificationRow; onClick: () => void }) {
  const unread = !note.read_at;
  const bg = unread ? 'bg-bg' : 'bg-fg/[0.02]';
  const itemClass = `flex items-start gap-2 px-3 py-2.5 transition hover:bg-fg/5 ${bg}`;
  const time = (
    <span className="ml-auto shrink-0 text-[10px] text-fg-muted">{relativeTime(note.created_at)}</span>
  );

  // type 별 렌더 — NotificationToast 와 동일 시각/카피 유지
  if (note.type === 'report_update') {
    const p = note.payload as ReportUpdatePayload;
    return (
      <button type="button" onClick={onClick} className={`w-full text-left ${itemClass}`}>
        <span aria-hidden className="text-base leading-none">📬</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg">제보가 처리됐어요</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {CATEGORY_LABEL[p.category] ?? p.category} ·{' '}
            <span className="font-medium text-fg">{STATUS_LABEL[p.status] ?? p.status}</span>
          </p>
        </div>
        {time}
      </button>
    );
  }

  if (note.type === 'report_new') {
    const p = note.payload as ReportNewPayload;
    return (
      <Link href="/admin/reports" onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">🚩</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg">새 제보</p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">
            {CATEGORY_LABEL[p.category] ?? p.category} ·{' '}
            <span className="font-medium text-fg">{p.author_name}</span>
          </p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'region_champion') {
    const p = note.payload as RegionChampionPayload;
    return (
      <Link href="/me" onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">👑</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-rose-900">🎉 {p.office_name} 대장이 됐어요</p>
          <p className="mt-0.5 text-[11px] text-rose-800/80">commit {p.commit_count}개 · 1위</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'badge_earned') {
    const p = note.payload as BadgeEarnedPayload;
    const meta = BADGE_BY_CODE.get(p.code);
    return (
      <Link href="/me" onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">{meta?.emoji ?? '🏆'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-amber-900">새 뱃지: {meta?.label ?? p.code}</p>
          <p className="mt-0.5 truncate text-[11px] text-amber-800/80">{meta?.description ?? ''}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'report_comment') {
    const p = note.payload as ReportCommentPayload;
    const fromAdmin = p.from === 'admin';
    const href = fromAdmin ? '/report' : '/admin/reports';
    return (
      <Link href={href} onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">💬</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg">
            {fromAdmin ? '관리자가 답글' : '제보자 답글'}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-fg-muted">{p.preview}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'review_reply') {
    const p = note.payload as ReviewReplyPayload;
    return (
      <Link href={`/map?focus=${p.restaurant_id}`} onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">💬</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg">
            <span className="font-medium">{p.reply_author_name}</span> 님 답글
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">📍 {p.restaurant_name}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'mention') {
    const p = note.payload as MentionPayload;
    return (
      <Link href={`/map?focus=${p.restaurant_id}`} onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">📣</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg">
            <span className="font-medium">{p.author_name}</span> 님이 멘션
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">📍 {p.restaurant_name}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'issue_answer') {
    const p = note.payload as IssueAnswerPayload;
    return (
      <Link href={`/issues/${p.issue_id}`} onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">💬</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg">
            내 issue <span className="font-mono">#{p.issue_number}</span> 에 답변이 달렸어요
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">{p.preview}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'issue_mention') {
    const p = note.payload as IssueMentionPayload;
    return (
      <Link href={`/issues/${p.issue_id}`} onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">📣</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-fg">
            <span className="font-medium">{p.author_name}</span> 님이 issue{' '}
            <span className="font-mono">#{p.issue_number}</span> 에서 멘션
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">{p.preview}</p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'pull_request_new') {
    const p = note.payload as PullRequestNewPayload;
    const isEdit = p.kind === 'edit';
    return (
      <Link href="/admin/pull-requests" onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">{isEdit ? '✏️' : '🔀'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg">
            새 {isEdit ? '수정' : '병합'} PR — {p.opener_name}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">
            {isEdit
              ? `${p.target_name ?? '?'} · ${p.edit_payload?.field ?? ''}`
              : `${p.source_name ?? '?'} → ${p.target_name ?? '?'}`}
          </p>
        </div>
        {time}
      </Link>
    );
  }

  if (note.type === 'pull_request_resolved') {
    const p = note.payload as PullRequestResolvedPayload;
    const merged = p.status === 'merged';
    const isEdit = p.kind === 'edit';
    return (
      <Link href="/map" onClick={onClick} className={itemClass}>
        <span aria-hidden className="text-base leading-none">{merged ? '✅' : '🚫'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg">
            {isEdit
              ? merged
                ? '수정 적용됐어요'
                : '수정 거부됐어요'
              : merged
                ? 'PR merged 됐어요'
                : 'PR 거부됐어요'}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-fg-muted">
            {isEdit ? p.target_name : `${p.source_name} → ${p.target_name}`}
          </p>
        </div>
        {time}
      </Link>
    );
  }

  return null;
}
