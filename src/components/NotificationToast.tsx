'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type {
  NotificationRow,
  ReportUpdatePayload,
  ReviewReplyPayload,
} from '@/types/db';

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
