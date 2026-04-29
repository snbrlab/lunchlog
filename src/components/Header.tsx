import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { MealModeToggle } from './MealModeToggle';
import { UserMenu } from './UserMenu';

// 인증된 영역의 공용 헤더 (SPEC 5.1).
// 좌: 로고. 중: 점심/저녁 토글. 우: 아바타 드롭다운.
export async function Header() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('name, email, avatar_color, avatar_emoji, role')
    .eq('id', user.id)
    .maybeSingle();

  const name = profile?.name ?? user.email ?? '익명';
  const email = profile?.email ?? user.email ?? '';
  const avatarColor = profile?.avatar_color ?? '#fde68a';
  const avatarEmoji = resolveAvatarEmoji(profile?.avatar_emoji, name + user.id);
  const isAdmin = profile?.role === 'admin';

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-bg px-3 sm:px-5">
      <Link href="/map" className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="text-lg">🍱</span>
        <span className="hidden text-sm font-semibold tracking-tight text-fg sm:inline">
          우리회사 맛집지도
        </span>
        <span className="text-sm font-semibold tracking-tight text-fg sm:hidden">맛집지도</span>
      </Link>

      <MealModeToggle />

      <div className="flex items-center gap-2">
        <Link
          href="/restaurants/new"
          aria-label="새 맛집 등록"
          className="rounded-md bg-fg px-3 py-1.5 text-xs font-semibold text-bg transition hover:opacity-90"
        >
          <span className="hidden sm:inline">+ 새 맛집</span>
          <span className="sm:hidden">+</span>
        </Link>
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
