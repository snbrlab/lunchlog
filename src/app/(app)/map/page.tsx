import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedBuildings } from '@/lib/cache/offices';
import { getCachedRestaurants } from '@/lib/cache/restaurants';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { getCurrentUserOrNull } from '@/lib/auth/current-user';
import MapShell from './MapShell';

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // D55: getCurrentUserOrNull 은 React cache() 로 Header 호출과 dedupe.
  const me = await getCurrentUserOrNull();
  if (!me) redirect('/login');
  const { user, profile } = me;
  // ?nudge=1 로 눈팅러 팝업 강제 노출 (테스트/QA 용, snooze 도 bypass)
  const sp = await searchParams;
  const forceNudge = sp.nudge === '1';

  const supabase = await createSupabaseServerClient();

  // D54: restaurants/buildings/cuisine_items 는 글로벌 캐시. favorites 는 사용자별.
  // myCommitCount: 눈팅러 판별 (가입 >7일 & commit 0)
  const [
    buildings,
    restaurants,
    cuisineItems,
    { data: favorites },
    { count: myCommitCount },
  ] = await Promise.all([
    getCachedBuildings(),
    getCachedRestaurants(),
    getCachedCuisineItems(),
    supabase.from('favorites').select('restaurant_id').eq('user_id', user.id),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id)
      .eq('reverted', false),
  ]);

  const joinedMs = user.created_at ? new Date(user.created_at).getTime() : Date.now();
  const daysSinceJoin = (Date.now() - joinedMs) / 86_400_000;
  const showLurkerNudge = forceNudge || (daysSinceJoin > 7 && (myCommitCount ?? 0) === 0);

  // D68: origin 우선순위 — 사용자 지정 좌표 > 등록 건물 > fallback
  const building = buildings.find((b) => b.id === profile?.building_id);
  const origin =
    profile?.custom_lat != null && profile?.custom_lng != null
      ? { lat: profile.custom_lat, lng: profile.custom_lng }
      : building
        ? { lat: building.latitude, lng: building.longitude }
        : { lat: 37.5604, lng: 126.8255 };

  const favoriteIds = ((favorites ?? []) as { restaurant_id: string }[]).map(
    (f) => f.restaurant_id,
  );

  return (
    <MapShell
      origin={origin}
      restaurants={restaurants}
      currentUserId={user.id}
      isAdmin={profile?.role === 'admin'}
      favoriteIds={favoriteIds}
      cuisineItems={cuisineItems}
      showLurkerNudge={showLurkerNudge}
      daysSinceJoin={daysSinceJoin}
      forceNudge={forceNudge}
    />
  );
}
