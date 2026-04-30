import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import MapShell from './MapShell';
import type { Restaurant } from '@/types/db';

// 카카오맵 + 사이드바. 디테일 패널은 Phase 5 에서 추가.
export default async function MapPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('office_id, building_id, role')
    .eq('id', user.id)
    .maybeSingle();

  // 사용자 건물 좌표 → 회사 마커 origin
  const { data: building } = await supabase
    .from('office_buildings')
    .select('latitude, longitude')
    .eq('id', profile?.building_id ?? '')
    .maybeSingle();

  const origin = building
    ? { lat: building.latitude, lng: building.longitude }
    : { lat: 37.5604, lng: 126.8255 }; // LG사이언스파크 fallback

  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(
      '*, creator:users!restaurants_created_by_fkey ( name, avatar_emoji, avatar_color )',
    )
    .eq('office_id', profile?.office_id ?? '')
    .order('last_commit_at', { ascending: false, nullsFirst: false });

  // 캐시된 commit_count 가 trigger 와 어긋날 수 있어 매번 reviews 에서 직접 카운트.
  // reverted 된 commit 은 제외 (사용자가 "실제 활성" 으로 인지하는 값).
  // 답글(branch) commit 은 포함 — git 메타포상 자식 commit 도 commit 임.
  const { data: reviewRows } = await supabase
    .from('reviews')
    .select('restaurant_id')
    .eq('reverted', false);

  const liveCounts = new Map<string, number>();
  for (const row of (reviewRows ?? []) as { restaurant_id: string }[]) {
    liveCounts.set(row.restaurant_id, (liveCounts.get(row.restaurant_id) ?? 0) + 1);
  }

  const restaurantsWithLiveCount = ((restaurants ?? []) as unknown as Restaurant[]).map(
    (r) => ({ ...r, commit_count: liveCounts.get(r.id) ?? 0 }),
  );

  return (
    <MapShell
      origin={origin}
      restaurants={restaurantsWithLiveCount}
      currentUserId={user.id}
      isAdmin={profile?.role === 'admin'}
    />
  );
}
