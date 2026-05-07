import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedOffices, getCachedBuildings } from '@/lib/cache/offices';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { formatRelativeTime } from '@/lib/format-time';
import ChangePasswordForm from './ChangePasswordForm';
import ProfileEditForm from './ProfileEditForm';

export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // D50: users.email column-level GRANT 로 SELECT 차단됨 → 본인 email 은 auth.getUser() 로
  const { data: profileRaw } = await supabase
    .from('users')
    .select(
      'name, avatar_color, avatar_emoji, role, department, office_id, building_id, ' +
        'office:offices ( name ), building:office_buildings!users_building_id_fkey ( name )',
    )
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRaw as unknown as
    | {
        name: string;
        avatar_color: string;
        avatar_emoji: string | null;
        role: 'member' | 'admin';
        department: string | null;
        office_id: string | null;
        building_id: string | null;
        office: { name: string } | null;
        building: { name: string } | null;
      }
    | null;

  const name = profile?.name ?? '';
  const email = user.email ?? '';
  const avatarEmoji = resolveAvatarEmoji(profile?.avatar_emoji, name + user.id);
  const avatarColor = profile?.avatar_color ?? '#fde68a';
  const officeName = profile?.office?.name ?? null;
  const buildingName = profile?.building?.name ?? null;

  const [offices, buildings, { data: myReviews }, { data: myFavorites }] = await Promise.all([
    getCachedOffices(),
    getCachedBuildings(),
    supabase
      .from('reviews')
      .select(
        'id, message, meal_time, party_size, hash, created_at, ' +
          'restaurant:restaurants!reviews_restaurant_id_fkey ( id, name, is_closed )',
      )
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('favorites')
      .select(
        'created_at, ' +
          'restaurant:restaurants ( id, name, cuisine_types, is_closed, commit_count )',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const reviewItems = ((myReviews ?? []) as unknown) as Array<{
    id: string;
    message: string;
    meal_time: 'lunch' | 'dinner';
    party_size: number | null;
    hash: string;
    created_at: string;
    restaurant: { id: string; name: string; is_closed: boolean } | null;
  }>;

  const favoriteItems = ((myFavorites ?? []) as unknown) as Array<{
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
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-fg">마이페이지</h1>

      {/* 프로필 헤더 */}
      <section className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-surface p-5">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{ backgroundColor: avatarColor }}
          aria-hidden
        >
          {avatarEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {name}
            {profile?.role === 'admin' && (
              <span className="ml-2 rounded bg-fg/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg">
                ADMIN
              </span>
            )}
          </p>
          <p className="truncate text-xs text-fg-muted">{email}</p>
          {(officeName || buildingName) && (
            <p className="mt-0.5 text-xs text-fg-muted">
              <span aria-hidden className="mr-1">📍</span>
              근무지 {officeName ?? '—'}
              {buildingName && ` · ${buildingName}`}
              {profile?.department && (
                <span className="ml-1.5 text-fg-muted/70">· {profile.department}</span>
              )}
            </p>
          )}
        </div>
      </section>

      {/* 프로필 편집 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-fg">프로필 편집</h2>
        <ProfileEditForm
          initialName={name}
          initialDepartment={profile?.department ?? ''}
          initialOfficeId={profile?.office_id ?? ''}
          initialBuildingId={profile?.building_id ?? ''}
          initialEmoji={avatarEmoji}
          avatarColor={avatarColor}
          offices={offices}
          buildings={buildings}
        />
      </section>

      {/* 비밀번호 변경 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-fg">비밀번호 변경</h2>
        <ChangePasswordForm />
      </section>

      {/* 찜한 곳 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-fg">
          ⭐ 찜한 곳 ({favoriteItems.length}개)
        </h2>
        {favoriteItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
            아직 찜한 식당이 없어요. /map 디테일 패널의 ☆ 를 눌러 찜할 수 있어요.
          </p>
        ) : (
          <ol className="rounded-lg border border-border bg-surface">
            {favoriteItems.map((f) =>
              f.restaurant ? (
                <li
                  key={f.restaurant.id}
                  className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm last:border-b-0"
                >
                  <Link
                    href={`/map?focus=${f.restaurant.id}`}
                    className="min-w-0 flex-1 truncate text-fg hover:underline"
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

      {/* 내 리뷰 목록 */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-fg">
          내 commit ({reviewItems.length}개)
        </h2>
        {reviewItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
            아직 작성한 리뷰가 없어요. /map 에서 첫 한 줄을 남겨주세요.
          </p>
        ) : (
          <ol className="rounded-lg border border-border bg-surface">
            {reviewItems.map((r) => (
              <li
                key={r.id}
                className="border-b border-border px-4 py-3 text-sm last:border-b-0"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                  <span className="font-mono">{r.hash}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(new Date(r.created_at))}</span>
                  <span aria-hidden>{r.meal_time === 'lunch' ? '☀' : '☾'}</span>
                  {r.party_size != null && <span>👥{r.party_size}</span>}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
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
                <p className="mt-0.5 text-sm text-fg">{r.message}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
