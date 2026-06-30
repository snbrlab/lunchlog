import Link from 'next/link';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { getCurrentUserOrNull } from '@/lib/auth/current-user';
import { MealModeToggle } from './MealModeToggle';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';

// 인증된 영역의 공용 헤더 (SPEC 5.1).
// 좌: 로고. 중: 점심/저녁 토글. 우: 아바타 드롭다운.
// D55: getCurrentUserOrNull 은 React cache() 로 한 요청 내 dedupe.
//      페이지 (/map, /me 등) 가 동일 호출 시 DB 왕복은 한 번만.
export async function Header() {
  const me = await getCurrentUserOrNull();
  if (!me) return null;
  const { user, profile } = me;

  const name = profile?.name ?? user.email ?? '익명';
  const email = user.email ?? '';
  const avatarColor = profile?.avatar_color ?? '#fde68a';
  const avatarEmoji = resolveAvatarEmoji(profile?.avatar_emoji, name + user.id);
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-bg px-3 sm:gap-4 sm:px-5">
      <Link href="/map" className="flex shrink-0 items-center gap-1.5">
        <span aria-hidden className="text-lg">🍱</span>
        <span className="text-sm font-semibold tracking-tight text-fg">런치로그</span>
      </Link>

      <MealModeToggle />

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/restaurants/new"
          aria-label="새 맛집 등록"
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-2.5 text-xs font-semibold text-fg transition hover:bg-fg/5 sm:bg-fg sm:px-3 sm:text-bg sm:hover:opacity-90"
        >
          <span className="hidden sm:inline">+ 새 맛집</span>
          <span aria-hidden className="text-base leading-none sm:hidden">＋</span>
        </Link>
        <Link
          href="/dev"
          aria-label="개발자 모드"
          title="개발자 모드 (가상 터미널)"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-base transition hover:bg-fg/5"
        >
          🖥️
        </Link>
        <NotificationBell />
        <UserMenu
          name={name}
          email={email}
          avatarColor={avatarColor}
          avatarEmoji={avatarEmoji}
          isAdmin={isAdmin}
        />
      </div>
    </header>
  );
}
