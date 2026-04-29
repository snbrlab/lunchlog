'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { signOut } from '@/lib/auth/actions';

interface Props {
  name: string;
  email: string;
  avatarColor: string;
  avatarEmoji: string;
  isAdmin: boolean;
}

export function UserMenu({ name, email, avatarColor, avatarEmoji, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // 라우트 변경 시 자동 닫힘 (Link onClick 으로 setOpen 부르면 navigation 과 race)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 바깥 클릭 시 닫힘. mousedown 대신 click 사용 — mousedown 은
  // 버튼의 click 사이클에 끼어들어 setState 와 race 가능.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base ring-1 ring-border transition hover:ring-fg/30"
        style={{ backgroundColor: avatarColor }}
        title={name}
      >
        <span aria-hidden>{avatarEmoji}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-bg shadow-2xl ring-1 ring-black/5"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-fg">
              {name}
              {isAdmin && (
                <span className="ml-2 rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
                  ADMIN
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-fg-muted">{email}</p>
          </div>
          <Link
            href="/me"
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-fg hover:bg-fg/5"
          >
            마이페이지
          </Link>
          <a
            href={`mailto:heejin.suh@lge.com?subject=${encodeURIComponent('[런치로그] 제보')}&body=${encodeURIComponent(
              `보내는 사람: ${name} (${email})\n\n제보 내용:\n\n`,
            )}`}
            role="menuitem"
            className="block px-4 py-2.5 text-sm text-fg hover:bg-fg/5"
          >
            🚩 관리자에게 제보
          </a>
          {isAdmin && (
            <Link
              href="/admin"
              role="menuitem"
              className="block px-4 py-2.5 text-sm text-fg hover:bg-fg/5"
            >
              ⚙️ 관리자
            </Link>
          )}
          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2.5 text-left text-sm text-fg hover:bg-fg/5"
            >
              로그아웃
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
