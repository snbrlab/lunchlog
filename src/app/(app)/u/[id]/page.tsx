import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { formatRelativeTime } from '@/lib/format-time';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { BadgeGrid } from '@/components/badges/BadgeGrid';
import { aggregateCounts } from '@/lib/heatmap';

interface PageProps {
  params: Promise<{ id: string }>;
}

// D50: 사용자 프로필 — 다른 사람이 닉네임 클릭하면 진입
// 단일 스크롤: 헤더 (아바타 + 닉네임 + 메타) + 작성한 commit + 찜한 곳
export default async function UserProfilePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();

  // D50: email 컬럼 SELECT 차단됨 — 프로필 페이지엔 어차피 표시 안 함
  const { data: profileRaw } = await supabase
    .from('users')
    .select(
      'id, name, avatar_color, avatar_emoji, role, department, ' +
        'office:offices ( name ), ' +
        'building:office_buildings!users_building_id_fkey ( name )',
    )
    .eq('id', id)
    .maybeSingle();

  if (!profileRaw) notFound();

  const profile = profileRaw as unknown as {
    id: string;
    name: string;
    avatar_color: string;
    avatar_emoji: string | null;
    role: 'member' | 'admin';
    department: string | null;
    office: { name: string } | null;
    building: { name: string } | null;
  };

  const isMe = viewer?.id === profile.id;
  const avatarEmoji = resolveAvatarEmoji(profile.avatar_emoji, profile.name + profile.id);

  // D52: 잔디용 — 지난 1년 commit 일자
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const [
    { data: reviews },
    { data: favorites },
    { data: heatmapRows },
    { data: badgeRows },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select(
        'id, message, meal_time, party_size, hash, reverted, created_at, ' +
          'restaurant:restaurants!reviews_restaurant_id_fkey ( id, name, cuisine_types, is_closed )',
      )
      .eq('author_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('favorites')
      .select(
        'created_at, ' +
          'restaurant:restaurants ( id, name, cuisine_types, is_closed, commit_count )',
      )
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('reviews')
      .select('created_at')
      .eq('author_id', profile.id)
      .gte('created_at', oneYearAgo.toISOString()),
    supabase.from('user_badges').select('code').eq('user_id', profile.id),
  ]);
  const badgeCodes = ((badgeRows ?? []) as { code: string }[]).map((b) => b.code);

  const heatmapCounts = aggregateCounts(
    ((heatmapRows ?? []) as { created_at: string }[]).map((r) => r.created_at),
  );

  const reviewItems = ((reviews ?? []) as unknown) as Array<{
    id: string;
    message: string;
    meal_time: 'lunch' | 'dinner';
    party_size: number | null;
    hash: string;
    reverted: boolean;
    created_at: string;
    restaurant: { id: string; name: string; cuisine_types: string[]; is_closed: boolean } | null;
  }>;

  const favoriteItems = ((favorites ?? []) as unknown) as Array<{
    created_at: string;
    restaurant: {
      id: string;
      name: string;
      cuisine_types: string[];
      is_closed: boolean;
      commit_count: number;
    } | null;
  }>;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      {/* 프로필 헤더 */}
      <section className="mb-6 rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-3">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-full text-3xl"
            style={{ backgroundColor: profile.avatar_color }}
            aria-hidden
          >
            {avatarEmoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-base font-semibold text-fg">
              {profile.name}
              {profile.role === 'admin' && (
                <span className="rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
                  ADMIN
                </span>
              )}
            </p>
            {(profile.office?.name || profile.building?.name) && (
              <p className="mt-1 text-xs text-fg-muted">
                <span aria-hidden className="mr-1">📍</span>
                {profile.office?.name ?? '—'}
                {profile.building?.name && ` · ${profile.building.name}`}
                {profile.department && (
                  <span className="text-fg-muted/70"> · {profile.department}</span>
                )}
              </p>
            )}
            {isMe && (
              <Link
                href="/me"
                className="mt-2 inline-block text-[11px] text-fg-muted underline-offset-2 hover:text-fg hover:underline"
              >
                프로필 편집 →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* D52: 활동 잔디 — 지난 1년 */}
      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-fg">🌱 활동</h2>
        <ActivityHeatmap counts={heatmapCounts} />
      </section>

      {/* D70: 받은 뱃지 (잠긴 거 X) */}
      <section className="mb-6 rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-medium text-fg">
          🏆 받은 뱃지 ({badgeCodes.length})
        </h2>
        <BadgeGrid codes={badgeCodes} />
      </section>

      {/* 작성한 commit */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-fg">
          📜 작성한 commit ({reviewItems.length})
        </h2>
        {reviewItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
            아직 작성한 commit 이 없어요.
          </p>
        ) : (
          <ol className="rounded-lg border border-border bg-surface">
            {reviewItems.map((r) => (
              <li
                key={r.id}
                className={`border-b border-border px-4 py-3 text-sm last:border-b-0 ${r.reverted ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-muted">
                  <span className="font-mono">{r.hash}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(new Date(r.created_at))}</span>
                  <span aria-hidden>{r.meal_time === 'lunch' ? '☀' : '☾'}</span>
                  {r.party_size != null && <span>👥{r.party_size}</span>}
                  {r.reverted && (
                    <span className="rounded bg-fg/10 px-1 py-0.5 text-[9px] font-semibold uppercase text-fg-muted">
                      reverted
                    </span>
                  )}
                </div>
                <div className="mt-1">
                  <Link
                    href={r.restaurant ? `/map?focus=${r.restaurant.id}` : '/map'}
                    className="text-xs font-medium text-fg hover:underline"
                  >
                    {r.restaurant?.name ?? '(삭제된 식당)'}
                    {r.restaurant?.is_closed && (
                      <span className="ml-1 text-fg-muted">[폐업]</span>
                    )}
                  </Link>
                </div>
                <p
                  className={`mt-1 text-sm ${r.reverted ? 'text-fg-muted line-through' : 'text-fg'}`}
                >
                  {r.message}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 찜한 곳 */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-fg">
          ⭐ 찜한 곳 ({favoriteItems.length})
        </h2>
        {favoriteItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
            아직 찜한 식당이 없어요.
          </p>
        ) : (
          <ol className="rounded-lg border border-border bg-surface">
            {favoriteItems.map((f) =>
              f.restaurant ? (
                <li
                  key={f.restaurant.id}
                  className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <Link
                    href={`/map?focus=${f.restaurant.id}`}
                    className="min-w-0 flex-1 text-fg hover:underline"
                  >
                    <span className="text-amber-500">★</span>{' '}
                    <span
                      className={
                        f.restaurant.is_closed ? 'text-fg-muted line-through' : 'text-fg'
                      }
                    >
                      {f.restaurant.name}
                    </span>
                    <span className="ml-1.5 text-[11px] text-fg-muted">
                      {f.restaurant.cuisine_types.join(' / ')}
                    </span>
                  </Link>
                  <span className="text-[10px] text-fg-muted">
                    commit {f.restaurant.commit_count}
                  </span>
                  <span className="text-[10px] text-fg-muted/70">
                    {formatRelativeTime(new Date(f.created_at))} 찜
                  </span>
                </li>
              ) : null,
            )}
          </ol>
        )}
      </section>
    </main>
  );
}
