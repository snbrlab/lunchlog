'use client';

// D59: 헤더 아래 sticky 공지 배너. git terminal 스타일 (monospace + > prefix).
// 사용자별 dismiss 는 localStorage 의 id 배열에 누적.

import { useEffect, useState } from 'react';

interface Announcement {
  id: string;
  body: string;
}

const STORAGE_KEY = 'lunchlog.announcements.dismissed.v1';

function readDismissed(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-50))); // 최근 50개만 유지
  } catch {
    // localStorage 쿼터 초과 등은 무시
  }
}

export function AnnouncementBanner({ items }: { items: Announcement[] }) {
  // SSR/CSR hydration mismatch 회피 — 마운트 후에 localStorage 읽음
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDismissed(new Set(readDismissed()));
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const visible = items.filter((it) => !dismissed.has(it.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    writeDismissed(Array.from(next));
  }

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-bg">
      {visible.map((it) => (
        <div
          key={it.id}
          className="flex items-center gap-2 px-3 py-1 font-mono text-[11px] text-fg-muted sm:px-5"
        >
          <span aria-hidden className="shrink-0 text-fg/60">{'>'}</span>
          <span className="min-w-0 flex-1 truncate text-fg">{it.body}</span>
          <button
            type="button"
            onClick={() => dismiss(it.id)}
            aria-label="공지 닫기"
            className="shrink-0 rounded px-1 text-fg-muted/60 transition hover:bg-fg/5 hover:text-fg"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
