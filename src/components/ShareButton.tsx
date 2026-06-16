'use client';

// D81: 공유 버튼 — 모바일은 native share sheet (카톡/메시지/메일), 데스크탑은 clipboard 복사.

import { useState } from 'react';

interface Props {
  title?: string;
  text: string;
  url: string;
  children: React.ReactNode;
  className?: string;
  copiedMessage?: string;
}

export function ShareButton({
  title,
  text,
  url,
  children,
  className,
  copiedMessage = '클립보드에 복사됐어요!',
}: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    // 데스크탑에선 navigator.share 가 Windows 공유 시트 OS panel 을 띄워 1-2초 버퍼링이
    // 발생하는 케이스가 있음. 터치 디바이스 (pointer: coarse) 만 native share 시도하고,
    // 데스크탑은 곧장 클립보드 복사 — 즉시 + 깔끔.
    const isTouch =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches;

    if (
      isTouch &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('복사해서 공유하세요', `${text}\n\n${url}`);
    }
  }

  return (
    <div className="relative inline-block">
      <button type="button" onClick={onShare} className={className}>
        {children}
      </button>
      {copied && (
        <span
          role="status"
          className="pointer-events-none absolute -bottom-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[10px] text-bg shadow-md"
        >
          ✓ {copiedMessage}
        </span>
      )}
    </div>
  );
}
