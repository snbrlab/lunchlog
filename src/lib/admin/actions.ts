'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { invalidateOfficesCache } from '@/lib/cache/offices';
import { invalidateRestaurantsCache } from '@/lib/cache/restaurants';
import { getServerEnv } from '@/lib/env';
import { avatarColorFor } from '@/lib/avatar-color';
import { isNicknameTaken, validateNicknameShape } from '@/lib/auth/nickname';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') throw new Error('관리자만 가능해요');
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
    return { ok: false, message: '좌표가 올바르지 않아요' };
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
  invalidateOfficesCache();
  return { ok: true };
}

// D73: 건물 삭제. users.building_id FK 는 ON DELETE SET NULL (migration).
// 빌딩 삭제 → office_buildings 트리거가 식당 office_id 자동 재매핑.
export type DeleteBuildingResult = { ok: true } | { ok: false; message: string };

export async function deleteBuilding(buildingId: string): Promise<DeleteBuildingResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const { error } = await admin.supabase
    .from('office_buildings')
    .delete()
    .eq('id', buildingId);
  if (error) return { ok: false, message: error.message };
  invalidateOfficesCache();
  return { ok: true };
}

// ---------------------------------------------------------------
// 사무실 / 건물 생성 (D49) — admin 페이지에서 직접 추가
// ---------------------------------------------------------------

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

function generateSlug(name: string): string {
  // 영문/숫자만 추출 → lowercase. 비어있거나 짧으면 random uuid prefix
  const ascii = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ascii.length >= 3) return `${ascii}-${Math.random().toString(36).slice(2, 8)}`;
  return `office-${crypto.randomUUID().slice(0, 8)}`;
}

export type CreateOfficeResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function createOffice(name: string): Promise<CreateOfficeResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 30) {
    return { ok: false, message: '사무실 이름 1~30자 입력해주세요' };
  }

  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  // default_lat/lng 는 NOT NULL 이지만 실제 코드에선 안 쓰이는 legacy 컬럼.
  // 건물의 lat/lng 가 회사 마커 origin 으로 쓰임. 그래서 placeholder 값 (서울 시청) 사용.
  const slug = generateSlug(trimmed);
  const { data, error } = await admin.supabase
    .from('offices')
    .insert({ name: trimmed, slug, default_lat: 37.5666, default_lng: 126.9784 })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  invalidateOfficesCache();
  return { ok: true, id: data.id };
}

export type CreateBuildingResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

export async function createBuilding(
  officeId: string,
  name: string,
  latitude: number,
  longitude: number,
): Promise<CreateBuildingResult> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 30) {
    return { ok: false, message: '건물 이름 1~30자 입력해주세요' };
  }
  if (!isValidCoord(latitude, longitude)) {
    return { ok: false, message: '좌표가 올바르지 않아요' };
  }
  if (!officeId) return { ok: false, message: '사무실을 선택해주세요' };

  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  // display_order 는 해당 office 의 기존 max + 1
  const { data: maxRow } = await admin.supabase
    .from('office_buildings')
    .select('display_order')
    .eq('office_id', officeId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.display_order ?? 0) + 1;

  const { data, error } = await admin.supabase
    .from('office_buildings')
    .insert({
      office_id: officeId,
      name: trimmed,
      latitude,
      longitude,
      display_order: nextOrder,
    })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  invalidateOfficesCache();
  return { ok: true, id: data.id };
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
    return { ok: false, message: 'KAKAO_REST_KEY 가 설정되지 않았어요. .env.local 을 확인해주세요' };
  }

  const { data: buildings, error: listError } = await admin.supabase
    .from('office_buildings')
    .select('id, name')
    .order('display_order');
  if (listError) return { ok: false, message: listError.message };
  if (!buildings) return { ok: false, message: '건물 목록을 가져오지 못했어요' };

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

  invalidateOfficesCache();
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
    return { ok: false, message: 'KAKAO_REST_KEY 가 설정되지 않았어요' };
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

  invalidateRestaurantsCache();
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
  invalidateRestaurantsCache();
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
    return { ok: false, message: '본인 admin 권한은 다른 admin 이 박탈해야 해요' };
  }

  const { error } = await admin.supabase
    .from('users')
    .update({ role })
    .eq('id', userId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

// ---------------------------------------------------------------
// 가입 요청 (admin 승인 흐름)
// ---------------------------------------------------------------

export type ApproveSignupResult = { ok: true } | { ok: false; message: string };

export async function approveSignup(requestId: string): Promise<ApproveSignupResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const sa = getSupabaseAdminClient();

  // 1) 요청 조회
  const { data: req, error: reqError } = await sa
    .from('signup_requests')
    .select('id, email, name, auth_user_id, status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqError) return { ok: false, message: reqError.message };
  if (!req) return { ok: false, message: '가입 요청을 찾을 수 없어요' };
  if (req.status !== 'pending') {
    return { ok: false, message: `이미 처리된 요청이에요 (${req.status})` };
  }

  // 2) auth.users.email_confirmed_at 세팅 (Supabase admin API)
  const { error: confirmError } = await sa.auth.admin.updateUserById(req.auth_user_id, {
    email_confirm: true,
  });
  if (confirmError) return { ok: false, message: confirmError.message };

  // 3) users 프로필 행 생성. 이미 있으면 (중복 승인 사고 등) skip.
  const { data: existing } = await sa
    .from('users')
    .select('id')
    .eq('id', req.auth_user_id)
    .maybeSingle();
  if (!existing) {
    const { error: insertError } = await sa.from('users').insert({
      id: req.auth_user_id,
      email: req.email,
      name: req.name,
      avatar_color: avatarColorFor(req.name + req.auth_user_id),
      password_set: true,
    });
    if (insertError) return { ok: false, message: insertError.message };
  }

  // 4) signup_requests 상태 업데이트
  const { error: updateError } = await sa
    .from('signup_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.userId,
    })
    .eq('id', requestId);
  if (updateError) return { ok: false, message: updateError.message };

  return { ok: true };
}

export type DenySignupResult = { ok: true } | { ok: false; message: string };

export async function denySignup(
  requestId: string,
  reason: string | null,
): Promise<DenySignupResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const sa = getSupabaseAdminClient();

  const { data: req, error: reqError } = await sa
    .from('signup_requests')
    .select('id, auth_user_id, status')
    .eq('id', requestId)
    .maybeSingle();
  if (reqError) return { ok: false, message: reqError.message };
  if (!req) return { ok: false, message: '가입 요청을 찾을 수 없어요' };
  if (req.status !== 'pending') {
    return { ok: false, message: `이미 처리된 요청이에요 (${req.status})` };
  }

  // 미승인 auth.users 정리. 실패해도 진행 (이미 삭제됐을 수 있음).
  await sa.auth.admin.deleteUser(req.auth_user_id);

  const { error: updateError } = await sa
    .from('signup_requests')
    .update({
      status: 'denied',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.userId,
      denied_reason: reason?.trim() || null,
    })
    .eq('id', requestId);
  if (updateError) return { ok: false, message: updateError.message };

  return { ok: true };
}

export type ResetPasswordResult =
  | { ok: true; tempPassword: string }
  | { ok: false; message: string };

// admin 이 사용자 비밀번호를 임시값으로 reset. 결과 임시 비번은 한 번만 화면에 표시.
// password_set=false 로 만들어 다음 로그인 시 /set-password 강제.
export async function resetUserPassword(userId: string): Promise<ResetPasswordResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const sa = getSupabaseAdminClient();

  // 12자 임시 비번 (영문 대소 + 숫자, 사람이 메신저로 옮기기 쉽게 특수문자 제외)
  const tempPassword = generateTempPassword(12);

  const { error: pwError } = await sa.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (pwError) return { ok: false, message: pwError.message };

  const { error: profileError } = await sa
    .from('users')
    .update({ password_set: false })
    .eq('id', userId);
  if (profileError) return { ok: false, message: profileError.message };

  return { ok: true, tempPassword };
}

function generateTempPassword(len: number): string {
  // 헷갈리는 문자(0/O/o, 1/I/l) 제외
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[arr[i]! % chars.length];
  }
  return out;
}

// ---------------------------------------------------------------
// D51: admin 이 임의 이메일로 사용자 직접 생성 (도메인 체크 우회)
// 외부 손님 / 도메인 안 맞는 사우 / 테스트 계정 등
// ---------------------------------------------------------------

export type CreateUserManuallyResult =
  | { ok: true; email: string; tempPassword: string }
  | { ok: false; message: string };

export async function createUserManually(
  email: string,
  name: string,
): Promise<CreateUserManuallyResult> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    return { ok: false, message: '이메일을 정확히 입력해주세요' };
  }
  const nameCheck = validateNicknameShape(name);
  if (!nameCheck.ok) return { ok: false, message: nameCheck.message };
  const trimmedName = nameCheck.normalized;

  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const sa = getSupabaseAdminClient();

  if (await isNicknameTaken(sa, trimmedName)) {
    return { ok: false, message: '이미 사용 중인 닉네임이에요' };
  }

  const tempPassword = generateTempPassword(12);

  // auth.users 생성 — email_confirm: true 로 즉시 활성, 도메인 체크 안 함
  const { data: created, error: createError } = await sa.auth.admin.createUser({
    email: trimmedEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: trimmedName },
  });
  if (createError || !created?.user) {
    const msg = createError?.message ?? '계정 생성 실패';
    if (msg.toLowerCase().includes('already')) {
      return { ok: false, message: '이미 가입된 이메일이에요' };
    }
    return { ok: false, message: msg };
  }

  // users 프로필 행 — password_set: false → 첫 로그인 시 /set-password 강제
  const { error: insertError } = await sa.from('users').insert({
    id: created.user.id,
    email: trimmedEmail,
    name: trimmedName,
    avatar_color: avatarColorFor(trimmedName + created.user.id),
    password_set: false,
  });
  if (insertError) {
    // users 행 생성 실패 → auth.users 도 롤백
    await sa.auth.admin.deleteUser(created.user.id);
    return { ok: false, message: insertError.message };
  }

  return { ok: true, email: trimmedEmail, tempPassword };
}

// ---------------------------------------------------------------
// D53: 사용자 삭제
// 리뷰/등록 식당은 D14 원칙대로 보존됨 (FK on delete set null).
// favorites / notifications / reports 는 cascade 로 같이 삭제.
// ---------------------------------------------------------------

export type DeleteUserResult = { ok: true } | { ok: false; message: string };

export async function deleteUser(userId: string): Promise<DeleteUserResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  if (admin.userId === userId) {
    return { ok: false, message: '본인 계정은 직접 삭제할 수 없어요' };
  }

  const sa = getSupabaseAdminClient();

  // 마지막 admin 보호
  const { data: target } = await sa
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (target?.role === 'admin') {
    const { count } = await sa
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin');
    if ((count ?? 0) <= 1) {
      return { ok: false, message: '마지막 admin 은 삭제할 수 없어요' };
    }
  }

  // auth.users 삭제 → users 는 on delete cascade 로 같이 삭제 → reviews/restaurants 는 set null
  const { error } = await sa.auth.admin.deleteUser(userId);
  if (error) return { ok: false, message: error.message };
  // restaurants 의 creator join 결과가 NULL 로 바뀌므로 캐시 무효화
  invalidateRestaurantsCache();
  return { ok: true };
}
