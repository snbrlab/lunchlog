import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import { formatRelativeTime } from '@/lib/format-time';
import ChangePasswordForm from './ChangePasswordForm';
import ProfileEditForm from './ProfileEditForm';
import type { Office, OfficeBuilding } from '@/types/db';

export default async function MePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileRaw } = await supabase
    .from('users')
    .select(
      'name, email, avatar_color, avatar_emoji, role, department, office_id, building_id, ' +
        'office:offices ( name ), building:office_buildings!users_building_id_fkey ( name )',
    )
    .eq('id', user.id)
    .maybeSingle();

  const profile = profileRaw as unknown as
    | {
        name: string;
        email: string;
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
  const email = profile?.email ?? user.email ?? '';
  const avatarEmoji = resolveAvatarEmoji(profile?.avatar_emoji, name + user.id);
  const avatarColor = profile?.avatar_color ?? '#fde68a';
  const officeName = profile?.office?.name ?? null;
  const buildingName = profile?.building?.name ?? null;

  const [{ data: offices }, { data: buildings }, { data: myReviews }] = await Promise.all([
    supabase.from('offices').select('*').order('name'),
    supabase.from('office_buildings').select('*').order('display_order'),
    supabase
      .from('reviews')
      .select(
        'id, message, meal_time, party_size, hash, created_at, ' +
          'restaurant:restaurants!reviews_restaurant_id_fkey ( id, name, is_closed )',
      )
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
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
          offices={(offices ?? []) as Office[]}
          buildings={(buildings ?? []) as OfficeBuilding[]}
        />
      </section>

      {/* 비밀번호 변경 */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-fg">비밀번호 변경</h2>
        <ChangePasswordForm />
      </section>

      {/* 내 리뷰 목록 */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-fg">
          내 commit ({reviewItems.length}개)
        </h2>
        {reviewItems.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-5 py-6 text-center text-xs text-fg-muted">
            아직 작성한 리뷰가 없어. /map 에서 첫 한 줄을 남겨줘.
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
                    href="/map"
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
