'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
} from '@/types/db';
import { BADGE_BY_CODE } from '@/lib/badges';

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

// 인앱 노티 토스트 (D41).
// (app)/layout 에 마운트. 페이지 로드 시 미확인 노티를 fetch 해서 우측 하단에 스택으로 표시.
// 사용자가 ✕ 또는 카드 클릭 시 read_at 채우고 토스트 제거.
export function NotificationToast() {
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      if (cancelled) return;
      setItems((data ?? []) as NotificationRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function dismiss(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id));
    const supabase = createSupabaseBrowserClient();
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  }

  if (items.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="알림"
      className="fixed bottom-4 right-4 z-50 flex w-[min(20rem,90vw)] flex-col gap-2"
    >
      {items.map((n) => (
        <ToastCard key={n.id} note={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  note,
  onDismiss,
}: {
  note: NotificationRow;
  onDismiss: () => void;
}) {
  if (note.type === 'report_update') {
    const p = note.payload as ReportUpdatePayload;
    return (
      <div className="rounded-lg border border-border bg-surface p-3 shadow-lg ring-1 ring-black/5">
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">📬</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              제보가 처리됐어요
            </p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              {CATEGORY_LABEL[p.category] ?? p.category} · 상태:{' '}
              <span className="font-medium text-fg">{STATUS_LABEL[p.status] ?? p.status}</span>
            </p>
            {p.admin_note && (
              <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg">
                {p.admin_note}
              </p>
            )}
          </div>
          <DismissButton onDismiss={onDismiss} />
        </div>
      </div>
    );
  }

  if (note.type === 'report_new') {
    const p = note.payload as ReportNewPayload;
    const CATEGORY_LABEL_MAP: Record<string, string> = {
      bug: '🐞 버그',
      feature: '💡 기능',
      restaurant: '🍽️ 식당',
      other: '💬 기타',
    };
    return (
      <Link
        href="/admin/reports"
        onClick={onDismiss}
        className="block rounded-lg border border-border bg-surface p-3 shadow-lg ring-1 ring-black/5 transition hover:border-fg/40"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">🚩</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">새 제보가 들어왔어요</p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              {CATEGORY_LABEL_MAP[p.category] ?? p.category} ·{' '}
              <span className="font-medium text-fg">{p.author_name}</span>
            </p>
            <p className="mt-1.5 line-clamp-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg">
              {p.message}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'region_champion') {
    const p = note.payload as RegionChampionPayload;
    return (
      <Link
        href="/me"
        onClick={onDismiss}
        className="block rounded-lg border border-rose-300 bg-rose-50 p-3 shadow-lg ring-1 ring-black/5 transition hover:border-rose-400"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-2xl leading-none">👑</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-rose-900">
              🎉 {p.office_name} 대장이 됐어요!
            </p>
            <p className="mt-0.5 text-[11px] text-rose-800/80">
              {p.office_name} 식당 commit {p.commit_count}개로 1위 — 왕관 획득 👑
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'badge_earned') {
    const p = note.payload as BadgeEarnedPayload;
    const meta = BADGE_BY_CODE.get(p.code);
    return (
      <Link
        href="/me"
        onClick={onDismiss}
        className="block rounded-lg border border-amber-300 bg-amber-50 p-3 shadow-lg ring-1 ring-black/5 transition hover:border-amber-400"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-2xl leading-none">{meta?.emoji ?? '🏆'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900">
              새 뱃지 획득!
            </p>
            <p className="mt-0.5 text-[12px] font-semibold text-amber-900">
              {meta?.label ?? p.code}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-800/80">
              {meta?.description ?? ''}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'report_comment') {
    const p = note.payload as ReportCommentPayload;
    const fromAdmin = p.from === 'admin';
    const href = fromAdmin ? '/report' : '/admin/reports';
    return (
      <Link
        href={href}
        onClick={onDismiss}
        className="block rounded-lg border border-border bg-surface p-3 shadow-lg ring-1 ring-black/5 transition hover:border-fg/40"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">💬</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              {fromAdmin ? '관리자가 제보에 답글을 남겼어요' : '제보자가 답글을 보냈어요'}
            </p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              {CATEGORY_LABEL[p.category] ?? p.category}
            </p>
            <p className="mt-1.5 line-clamp-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg">
              {p.preview}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'review_reply') {
    const p = note.payload as ReviewReplyPayload;
    return (
      <Link
        href={`/map?focus=${p.restaurant_id}`}
        onClick={onDismiss}
        className="block rounded-lg border border-border bg-surface p-3 shadow-lg ring-1 ring-black/5 transition hover:border-fg/40"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">💬</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-fg">
              <span className="font-medium">{p.reply_author_name}</span> 님이{' '}
              <span className="font-mono text-xs">{p.parent_hash}</span> 에 답글을 달았어요
            </p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              📍 {p.restaurant_name}
            </p>
            <p className="mt-1.5 line-clamp-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg">
              {p.message}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'pull_request_new') {
    const p = note.payload as PullRequestNewPayload;
    return (
      <Link
        href="/admin/pull-requests"
        onClick={onDismiss}
        className="block rounded-lg border border-border bg-surface p-3 shadow-lg ring-1 ring-black/5 transition hover:border-fg/40"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">🔀</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">새 PR 이 들어왔어요</p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              <span className="font-medium text-fg">{p.opener_name}</span> · {p.source_name} →{' '}
              {p.target_name}
            </p>
            {p.reason && (
              <p className="mt-1.5 line-clamp-2 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-fg">
                {p.reason}
              </p>
            )}
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'pull_request_resolved') {
    const p = note.payload as PullRequestResolvedPayload;
    const merged = p.status === 'merged';
    return (
      <Link
        href="/map"
        onClick={onDismiss}
        className={`block rounded-lg border p-3 shadow-lg ring-1 ring-black/5 transition ${
          merged
            ? 'border-sky-300 bg-sky-50 hover:border-sky-400'
            : 'border-border bg-surface hover:border-fg/40'
        }`}
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">{merged ? '✅' : '🚫'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">
              PR 이 {merged ? 'merged 됐어요' : '거부됐어요'}
            </p>
            <p className="mt-0.5 text-[11px] text-fg-muted">
              {p.source_name} → {p.target_name}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  if (note.type === 'mention') {
    const p = note.payload as MentionPayload;
    return (
      <Link
        href={`/map?focus=${p.restaurant_id}`}
        onClick={onDismiss}
        className="block rounded-lg border border-sky-300 bg-sky-50 p-3 shadow-lg ring-1 ring-black/5 transition hover:border-sky-400"
      >
        <div className="flex items-start gap-2">
          <span aria-hidden className="text-base">📣</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-sky-900">
              <span className="font-medium">{p.author_name}</span> 님이 멘션했어요
            </p>
            <p className="mt-0.5 text-[11px] text-sky-800/80">
              📍 {p.restaurant_name}
            </p>
            <p className="mt-1.5 line-clamp-2 rounded-md border border-sky-200 bg-white px-2 py-1.5 text-xs text-fg">
              {p.message}
            </p>
          </div>
          <DismissButton
            onDismiss={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              onDismiss();
            }}
          />
        </div>
      </Link>
    );
  }

  return null;
}

function DismissButton({
  onDismiss,
}: {
  onDismiss: (e?: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onDismiss(e)}
      aria-label="닫기"
      className="-m-1 rounded p-1 text-fg-muted hover:bg-fg/10 hover:text-fg"
    >
      ✕
    </button>
  );
}
