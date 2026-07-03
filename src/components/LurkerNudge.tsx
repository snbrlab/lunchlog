'use client';

// 눈팅러 nudge — 가입 >7일 & commit 0 인 유저에게 /map 진입 시 조용히 노출.
// 7일 snooze (localStorage).

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'lunchlog.lurker.snoozedAt.v1';
const SNOOZE_DAYS = 7;

export function LurkerNudge({
  daysSinceJoin,
  force = false,
}: {
  daysSinceJoin: number;
  force?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (force) {
      setShow(true);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const snoozedAt = Number(raw);
        if (
          Number.isFinite(snoozedAt) &&
          (Date.now() - snoozedAt) / 86_400_000 < SNOOZE_DAYS
        )
          return;
      }
    } catch {
      // localStorage 사용 불가면 그냥 보여줌
    }
    setShow(true);
  }, [force]);

  if (!show) return null;

  function dismiss() {
    // force 모드에선 snooze 저장 안 함 (테스트 반복 가능하게)
    if (!force) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        // 쿼터 초과 무시
      }
    }
    setShow(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[min(20rem,calc(100vw-2rem))] rounded-md border border-border bg-bg font-mono text-[12px] shadow-lg">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-fg-muted">
        <span>~/lunchlog</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="닫기"
          className="rounded px-1 text-fg-muted/60 transition hover:bg-fg/5 hover:text-fg"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div className="text-fg">
          <span className="text-emerald-500">$</span> git log --author=me
        </div>
        <div className="text-red-400">fatal: your branch has no commits yet</div>
        <div className="pt-1 leading-relaxed text-fg-muted">
          가입한 지 {Math.floor(daysSinceJoin)}일, 아직 첫 리뷰가 없어요.
          <br />
          오늘 점심 한 줄 남겨볼까요?
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="mt-1 w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-center text-emerald-500 transition hover:bg-emerald-500/20"
        >
          $ 지도에서 골라보기 →
        </button>
      </div>
    </div>
  );
}
