import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedBuildings } from '@/lib/cache/offices';
import { getCachedRestaurants } from '@/lib/cache/restaurants';
import { getCachedCuisineItems } from '@/lib/cache/cuisine-items';
import { getCurrentUserOrNull } from '@/lib/auth/current-user';
import MapShell from './MapShell';

export default async function MapPage() {
  // D55: getCurrentUserOrNull 은 React cache() 로 Header 호출과 dedupe.
  const me = await getCurrentUserOrNull();
  if (!me) redirect('/login');
  const { user, profile } = me;

  const supabase = await createSupabaseServerClient();

  // D54: restaurants/buildings/cuisine_items 는 글로벌 캐시. favorites 는 사용자별.
  const [buildings, restaurants, cuisineItems, { data: favorites }] = await Promise.all([
    getCachedBuildings(),
    getCachedRestaurants(),
    getCachedCuisineItems(),
    supabase.from('favorites').select('restaurant_id').eq('user_id', user.id),
  ]);

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
    />
  );
}
