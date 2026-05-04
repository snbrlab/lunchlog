import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCachedBuildings } from '@/lib/cache/offices';
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

  // 사용자 건물 좌표 → 회사 마커 origin (전체 buildings 는 캐시됨)
  const buildings = await getCachedBuildings();
  const building = buildings.find((b) => b.id === profile?.building_id);
  const origin = building
    ? { lat: building.latitude, lng: building.longitude }
    : { lat: 37.5604, lng: 126.8255 }; // LG사이언스파크 fallback

  // 사이드바 + 디테일 패널에 필요한 컬럼만 명시. SELECT * 회피 (egress 절약).
  // commit_count 는 D42 trigger 가 revert 까지 정합성 유지 → 캐시 컬럼 그대로 신뢰.
  // office_id 필터 제거 (D43): 식당의 office_id 는 "누가 처음 등록했냐" 메타데이터일 뿐.
  // 거리는 사용자 본인 건물 기준이라 다른 사무실 동료가 등록한 식당도 다 보여야 함.
  const { data: restaurants } = await supabase
    .from('restaurants')
    .select(
      [
        'id',
        'name',
        'categories',
        'cuisine_types',
        'menu_tags',
        'price_level',
        'latitude',
        'longitude',
        'address',
        'note',
        'office_id',
        'is_closed',
        'created_by',
        'created_at',
        'commit_count',
        'last_commit_at',
        'recommended_min_size',
        'recommended_max_size',
        'has_alcohol',
        'kakao_place_url',
        'creator:users!restaurants_created_by_fkey ( name, avatar_emoji, avatar_color )',
      ].join(', '),
    )
    .order('last_commit_at', { ascending: false, nullsFirst: false });

  return (
    <MapShell
      origin={origin}
      restaurants={(restaurants ?? []) as unknown as Restaurant[]}
      currentUserId={user.id}
      isAdmin={profile?.role === 'admin'}
    />
  );
}
