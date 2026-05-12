import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedBuildings } from '@/lib/cache/offices';
import { getCachedRestaurants } from '@/lib/cache/restaurants';
import MapShell from './MapShell';

// 카카오맵 + 사이드바. 디테일 패널은 Phase 5 에서 추가.
export default async function MapPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 사용자별 가벼운 fetch (profile, favorites) 와 글로벌 캐시된 fetch (buildings, restaurants) 병렬.
  // D54: restaurants 는 모든 사용자에게 동일한 데이터 → unstable_cache 로 묶음.
  // commit/식당 변경 action 들이 invalidateRestaurantsCache 호출로 즉시 무효화.
  const [
    { data: profile },
    buildings,
    restaurants,
    { data: favorites },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('office_id, building_id, role')
      .eq('id', user.id)
      .maybeSingle(),
    getCachedBuildings(),
    getCachedRestaurants(),
    supabase.from('favorites').select('restaurant_id').eq('user_id', user.id),
  ]);

  // 사용자 건물 좌표 → 회사 마커 origin
  const building = buildings.find((b) => b.id === profile?.building_id);
  const origin = building
    ? { lat: building.latitude, lng: building.longitude }
    : { lat: 37.5604, lng: 126.8255 }; // LG사이언스파크 fallback

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
    />
  );
}
