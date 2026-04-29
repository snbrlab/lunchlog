import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import NewRestaurantForm from './NewRestaurantForm';

export default async function NewRestaurantPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // 사용자 건물 좌표를 검색 기준점으로 (가까운 곳 우선 노출)
  const { data: profile } = await supabase
    .from('users')
    .select('building_id')
    .eq('id', user.id)
    .maybeSingle();

  const { data: building } = profile?.building_id
    ? await supabase
        .from('office_buildings')
        .select('latitude, longitude')
        .eq('id', profile.building_id)
        .maybeSingle()
    : { data: null };

  const origin = building
    ? { lat: building.latitude, lng: building.longitude }
    : { lat: 37.5604, lng: 126.8255 };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold tracking-tight text-fg">+ 새 맛집 등록</h1>
      <NewRestaurantForm origin={origin} />
    </main>
  );
}
