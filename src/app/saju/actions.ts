'use server';

// 운명의 점심 오행 장르 → 우리 식당 추천. /saju 는 공개(비로그인)라 service-role 로 조회.
// 생일 등 개인정보는 서버로 안 보냄 — 여기 오는 건 cuisine 힌트뿐.
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface SajuRestaurant {
  id: string;
  name: string;
  cuisine_types: string[];
  region: string | null;
  commit_count: number;
}

// cuisineHints 와 겹치는 cuisine_types 를 가진 식당 중 commit 많은 순. seed 로 상위 몇 개 중 하나.
export async function recommendRestaurant(
  cuisineHints: string[],
  seed: number,
): Promise<SajuRestaurant | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types, commit_count, office:offices ( name )')
    .eq('is_closed', false)
    .overlaps('cuisine_types', cuisineHints)
    .order('commit_count', { ascending: false })
    .limit(8);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    cuisine_types: string[];
    commit_count: number;
    office: { name: string } | null;
  }[];
  if (rows.length === 0) return null;

  const pick = rows[((seed % rows.length) + rows.length) % rows.length]!;
  return {
    id: pick.id,
    name: pick.name,
    cuisine_types: pick.cuisine_types,
    region: pick.office?.name ?? null,
    commit_count: pick.commit_count,
  };
}
