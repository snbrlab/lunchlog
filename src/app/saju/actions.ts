'use server';

// 운명의 점심 → 우리 식당 추천. /saju 는 공개(비로그인)라 service-role 로 조회.
// 생일 등 개인정보는 서버로 안 보냄 — 여기 오는 건 메뉴/오행 힌트뿐.
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export interface SajuRestaurant {
  id: string;
  name: string;
  cuisine_types: string[];
  region: string | null;
  commit_count: number;
  matchType: 'menu' | 'genre'; // 메뉴까지 맞은 집 / 오행 장르 인기집
}

// 메뉴명에서 검색 토큰 뽑기 (예: "매운 양념 등갈비찜" → ["매운양념등갈비찜","매운","양념","등갈비찜"])
function menuTokens(menu: string): string[] {
  const words = menu.split(/\s+/).filter((w) => w.length >= 2);
  return Array.from(new Set([menu.replace(/\s+/g, ''), ...words]));
}

// 1순위: 뽑힌 메뉴가 식당 이름·menu_tags 에 걸리는 집. 없으면 오행 장르 인기집.
export async function recommendRestaurant(
  cuisineHints: string[],
  seed: number,
  menu: string,
): Promise<SajuRestaurant | null> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase
    .from('restaurants')
    .select('id, name, cuisine_types, menu_tags, commit_count, office:offices ( name )')
    .eq('is_closed', false)
    .overlaps('cuisine_types', cuisineHints)
    .order('commit_count', { ascending: false })
    .limit(40);

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    cuisine_types: string[];
    menu_tags: string[] | null;
    commit_count: number;
    office: { name: string } | null;
  }[];
  if (rows.length === 0) return null;

  // 메뉴 토큰이 이름/태그에 걸리는 집 우선
  const tokens = menuTokens(menu);
  const matched = rows.filter((r) => {
    const name = r.name.replace(/\s+/g, '');
    const tags = r.menu_tags ?? [];
    return tokens.some(
      (t) => name.includes(t) || tags.some((tag) => tag.includes(t) || t.includes(tag)),
    );
  });

  const pool = matched.length > 0 ? matched : rows;
  const pick = pool[((seed % pool.length) + pool.length) % pool.length]!;
  return {
    id: pick.id,
    name: pick.name,
    cuisine_types: pick.cuisine_types,
    region: pick.office?.name ?? null,
    commit_count: pick.commit_count,
    matchType: matched.length > 0 ? 'menu' : 'genre',
  };
}
