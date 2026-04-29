import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CUISINE_GROUPS, findCuisineGroup } from '@/lib/cuisine';
import { resolveAvatarEmoji } from '@/lib/avatar-emoji';
import type { CuisineType, Restaurant, Review } from '@/types/db';

export default async function RankingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('office_id')
    .eq('id', user.id)
    .maybeSingle();
  const officeId = profile?.office_id ?? '';

  // 1) 인기 식당 (commit 많은 순)
  const { data: popularRaw } = await supabase
    .from('restaurants')
    .select(
      'id, name, cuisine_type, commit_count, last_commit_at, has_alcohol, is_closed',
    )
    .eq('office_id', officeId)
    .eq('is_closed', false)
    .order('commit_count', { ascending: false })
    .limit(5);

  // 2) 활동러 (사용자별 commit 수)
  // 본인 office 의 식당 한정으로 reviews join. 단순화: reviews 다 가져오고 client 집계.
  const { data: recentReviews } = await supabase
    .from('reviews')
    .select(
      'id, author_id, restaurant_id, created_at, ' +
        'author:users!reviews_author_id_fkey ( name, avatar_emoji, avatar_color ), ' +
        'restaurant:restaurants!reviews_restaurant_id_fkey ( office_id, cuisine_type, name )',
    )
    .order('created_at', { ascending: false })
    .limit(500);

  type EnrichedReview = Review & {
    author: { name: string; avatar_emoji: string | null; avatar_color: string } | null;
    restaurant: { office_id: string; cuisine_type: string; name: string } | null;
  };
  const reviews = ((recentReviews ?? []) as unknown) as EnrichedReview[];
  const officeReviews = reviews.filter((r) => r.restaurant?.office_id === officeId);

  // 활동러 집계
  const userMap = new Map<
    string,
    { name: string; emoji: string | null; color: string; count: number }
  >();
  for (const r of officeReviews) {
    if (!r.author_id || !r.author) continue;
    const cur = userMap.get(r.author_id);
    if (cur) cur.count += 1;
    else
      userMap.set(r.author_id, {
        name: r.author.name,
        emoji: r.author.avatar_emoji,
        color: r.author.avatar_color,
        count: 1,
      });
  }
  const topUsers = Array.from(userMap.entries())
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 3) 최근 7일 핫한 식당
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const hotMap = new Map<string, { name: string; cuisine: string; count: number }>();
  for (const r of officeReviews) {
    if (!r.restaurant) continue;
    if (Date.now() - new Date(r.created_at).getTime() > SEVEN_DAYS) continue;
    const cur = hotMap.get(r.restaurant_id);
    if (cur) cur.count += 1;
    else
      hotMap.set(r.restaurant_id, {
        name: r.restaurant.name,
        cuisine: r.restaurant.cuisine_type,
        count: 1,
      });
  }
  const hotList = Array.from(hotMap.entries())
    .map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // 4) cuisine 그룹 분포
  const { data: allRestaurants } = await supabase
    .from('restaurants')
    .select('cuisine_type, is_closed')
    .eq('office_id', officeId)
    .eq('is_closed', false);

  const groupCount = new Map<string, number>();
  for (const r of (allRestaurants ?? []) as { cuisine_type: string }[]) {
    const g = findCuisineGroup(r.cuisine_type as CuisineType) ?? '기타';
    groupCount.set(g, (groupCount.get(g) ?? 0) + 1);
  }
  const groupDistribution = CUISINE_GROUPS.map((g) => ({
    label: g.label,
    emoji: g.emoji,
    count: groupCount.get(g.label) ?? 0,
  }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
  const totalRestaurants = groupDistribution.reduce((s, g) => s + g.count, 0);

  const popular = (popularRaw ?? []) as Pick<
    Restaurant,
    'id' | 'name' | 'cuisine_type' | 'commit_count' | 'last_commit_at' | 'has_alcohol' | 'is_closed'
  >[];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">🏆 랭킹</h1>
      <p className="mb-6 text-xs text-fg-muted">
        본 사무실의 commit 데이터 기반 통계.
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        {/* 인기 식당 */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-fg">🔥 인기 식당 (commit 누적)</h2>
          {popular.length === 0 ? (
            <p className="text-xs text-fg-muted">아직 commit 이 있는 식당이 없어</p>
          ) : (
            <ol className="space-y-2">
              {popular.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center font-mono text-xs text-fg-muted">
                    {i + 1}
                  </span>
                  <Link
                    href="/map"
                    className="flex-1 truncate text-fg hover:underline"
                  >
                    {r.name} {r.has_alcohol && '🍺'}
                  </Link>
                  <span className="text-xs font-mono text-fg-muted">{r.commit_count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 활동러 */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-fg">⚡ 활동러 (commit 작성 수)</h2>
          {topUsers.length === 0 ? (
            <p className="text-xs text-fg-muted">아직 활동 기록 없음</p>
          ) : (
            <ol className="space-y-2">
              {topUsers.map((u, i) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center font-mono text-xs text-fg-muted">
                    {i + 1}
                  </span>
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: u.color }}
                    aria-hidden
                  >
                    {resolveAvatarEmoji(u.emoji, u.name + u.id)}
                  </span>
                  <span className="flex-1 truncate text-fg">{u.name}</span>
                  <span className="text-xs font-mono text-fg-muted">{u.count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* 최근 7일 핫함 */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-fg">📈 최근 7일 핫함</h2>
          {hotList.length === 0 ? (
            <p className="text-xs text-fg-muted">최근 일주일 commit 이 없네</p>
          ) : (
            <ol className="space-y-2">
              {hotList.map((r, i) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center font-mono text-xs text-fg-muted">
                    {i + 1}
                  </span>
                  <Link href="/map" className="flex-1 truncate text-fg hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-fg-muted">{r.cuisine}</span>
                  <span className="text-xs font-mono text-fg-muted">{r.count}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* cuisine 그룹 분포 */}
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-medium text-fg">🍱 음식 분포 (등록 식당 기준)</h2>
          {totalRestaurants === 0 ? (
            <p className="text-xs text-fg-muted">아직 등록된 식당 없음</p>
          ) : (
            <ol className="space-y-2">
              {groupDistribution.map((g) => {
                const pct = Math.round((g.count / totalRestaurants) * 100);
                return (
                  <li key={g.label} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-fg">
                        <span aria-hidden className="mr-1.5">
                          {g.emoji}
                        </span>
                        {g.label}
                      </span>
                      <span className="text-fg-muted">
                        {g.count}개 · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-fg/10">
                      <div
                        className="h-full bg-fg/40"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
