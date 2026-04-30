// offices / office_buildings 는 거의 변하지 않음 (admin 이 가끔 좌표 보정 정도).
// 매 페이지마다 fetch 하던 걸 Next.js cache 로 묶어서 egress 절감.
//
// service-role 클라이언트로 fetch — RLS 우회 + 쿠키 무관 → 캐시 가능.
// 데이터 자체는 사용자별로 다르지 않으므로 (전체 organization 공통) 글로벌 캐시 안전.
//
// admin 의 좌표 자동 보정 / 건물 추가 후엔 `revalidateTag('offices')` 호출 필요.

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Office, OfficeBuilding } from '@/types/db';

const TAG = 'offices';
const REVALIDATE_SECONDS = 60 * 60 * 24; // 24h. 변경 시엔 invalidateOfficesCache() 로 즉시 무효화.

export const getCachedOffices = unstable_cache(
  async () => {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase.from('offices').select('*').order('name');
    return (data ?? []) as Office[];
  },
  ['offices-all'],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export const getCachedBuildings = unstable_cache(
  async () => {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from('office_buildings')
      .select('*')
      .order('display_order');
    return (data ?? []) as OfficeBuilding[];
  },
  ['buildings-all'],
  { revalidate: REVALIDATE_SECONDS, tags: [TAG] },
);

export function invalidateOfficesCache() {
  revalidateTag(TAG);
}
