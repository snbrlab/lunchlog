'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인 필요');
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') throw new Error('관리자만');
  return { supabase, userId: user.id };
}

export type UpdateBuildingResult =
  | { ok: true }
  | { ok: false; message: string };

export async function updateBuildingCoord(
  buildingId: string,
  latitude: number,
  longitude: number,
): Promise<UpdateBuildingResult> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, message: '좌표가 올바르지 않아' };
  }

  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { error } = await admin.supabase
    .from('office_buildings')
    .update({ latitude, longitude })
    .eq('id', buildingId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type AutoFillResult =
  | {
      ok: true;
      results: Array<{ name: string; status: 'updated' | 'not_found' | 'failed'; lat?: number; lng?: number }>;
    }
  | { ok: false; message: string };

interface KakaoSearchResponse {
  documents?: Array<{
    place_name: string;
    address_name: string;
    road_address_name: string;
    place_url?: string;
    x: string; // longitude
    y: string; // latitude
  }>;
}

// 모든 건물 좌표를 카카오 REST API 로 자동 보정.
// 검색어: "LG사이언스파크 W1" 같이. 첫 결과의 좌표 사용.
export async function autoFillAllBuildingCoords(): Promise<AutoFillResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { kakaoRestKey } = getServerEnv();
  if (!kakaoRestKey) {
    return { ok: false, message: 'KAKAO_REST_KEY 가 설정 안 됨. .env.local 확인' };
  }

  const { data: buildings, error: listError } = await admin.supabase
    .from('office_buildings')
    .select('id, name')
    .order('display_order');
  if (listError) return { ok: false, message: listError.message };
  if (!buildings) return { ok: false, message: '건물 목록을 못 가져옴' };

  const results: Array<{
    name: string;
    status: 'updated' | 'not_found' | 'failed';
    lat?: number;
    lng?: number;
  }> = [];

  // 동시 fetch (25개라 부담 없음). 카카오 rate limit 30만/일.
  await Promise.all(
    buildings.map(async (b) => {
      const query = `LG사이언스파크 ${b.name}`;
      try {
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`,
          {
            headers: { Authorization: `KakaoAK ${kakaoRestKey}` },
            cache: 'no-store',
          },
        );
        if (!res.ok) {
          results.push({ name: b.name, status: 'failed' });
          return;
        }
        const json = (await res.json()) as KakaoSearchResponse;
        const first = json.documents?.[0];
        if (!first) {
          results.push({ name: b.name, status: 'not_found' });
          return;
        }
        const lat = parseFloat(first.y);
        const lng = parseFloat(first.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          results.push({ name: b.name, status: 'failed' });
          return;
        }
        const { error } = await admin.supabase
          .from('office_buildings')
          .update({ latitude: lat, longitude: lng })
          .eq('id', b.id);
        if (error) {
          results.push({ name: b.name, status: 'failed' });
          return;
        }
        results.push({ name: b.name, status: 'updated', lat, lng });
      } catch {
        results.push({ name: b.name, status: 'failed' });
      }
    }),
  );

  return { ok: true, results };
}

export type AutoFillPlaceUrlsResult =
  | {
      ok: true;
      results: Array<{
        id: string;
        name: string;
        status: 'updated' | 'not_found' | 'failed';
        url?: string;
      }>;
    }
  | { ok: false; message: string };

// place_url 이 NULL 인 식당만 대상으로, 이름 + 좌표 기반 카카오 검색해서 best match 의 place_url 자동 저장.
// best match: 정확 일치 우선 → 100m 이내 + 이름 부분 일치 → 첫 결과 fallback.
export async function autoFillKakaoPlaceUrlsForRestaurants(): Promise<AutoFillPlaceUrlsResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const { kakaoRestKey } = getServerEnv();
  if (!kakaoRestKey) {
    return { ok: false, message: 'KAKAO_REST_KEY 가 설정 안 됨' };
  }

  const { data: targets, error: listError } = await admin.supabase
    .from('restaurants')
    .select('id, name, latitude, longitude')
    .is('kakao_place_url', null);
  if (listError) return { ok: false, message: listError.message };
  if (!targets || targets.length === 0) {
    return { ok: true, results: [] };
  }

  const results: Array<{
    id: string;
    name: string;
    status: 'updated' | 'not_found' | 'failed';
    url?: string;
  }> = [];

  await Promise.all(
    targets.map(async (r) => {
      try {
        const params = new URLSearchParams({
          query: r.name,
          x: String(r.longitude),
          y: String(r.latitude),
          radius: '500',
          sort: 'distance',
          size: '5',
        });
        const res = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${params}`,
          {
            headers: { Authorization: `KakaoAK ${kakaoRestKey}` },
            cache: 'no-store',
          },
        );
        if (!res.ok) {
          results.push({ id: r.id, name: r.name, status: 'failed' });
          return;
        }
        const json = (await res.json()) as KakaoSearchResponse;
        const docs = json.documents ?? [];
        if (docs.length === 0) {
          results.push({ id: r.id, name: r.name, status: 'not_found' });
          return;
        }
        // best match: 이름 정확 일치 우선, 없으면 첫 결과 (=가장 가까운)
        const exact = docs.find((d) => d.place_name === r.name);
        const best = exact ?? docs[0]!;
        if (!best.place_url) {
          results.push({ id: r.id, name: r.name, status: 'not_found' });
          return;
        }
        const { error } = await admin.supabase
          .from('restaurants')
          .update({ kakao_place_url: best.place_url })
          .eq('id', r.id);
        if (error) {
          results.push({ id: r.id, name: r.name, status: 'failed' });
          return;
        }
        results.push({ id: r.id, name: r.name, status: 'updated', url: best.place_url });
      } catch {
        results.push({ id: r.id, name: r.name, status: 'failed' });
      }
    }),
  );

  return { ok: true, results };
}

export type DeleteRestaurantResult =
  | { ok: true }
  | { ok: false; message: string };

export async function deleteRestaurant(restaurantId: string): Promise<DeleteRestaurantResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const { error } = await admin.supabase
    .from('restaurants')
    .delete()
    .eq('id', restaurantId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export type SetUserRoleResult =
  | { ok: true }
  | { ok: false; message: string };

export async function setUserRole(
  userId: string,
  role: 'member' | 'admin',
): Promise<SetUserRoleResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  // 자기 자신의 admin 권한 박탈은 금지 (마지막 admin 빠지는 사고 방지)
  if (admin.userId === userId && role !== 'admin') {
    return { ok: false, message: '본인 admin 권한은 다른 admin 이 박탈해야 해' };
  }

  const { error } = await admin.supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
