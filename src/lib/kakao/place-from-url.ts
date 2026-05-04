'use server';

// 카카오 Places API (keyword search) 에 잡히지 않는 식당을 위한 우회 등록.
//
// 비공식 endpoint (place.map.kakao.com/main/v/{id}) 는 카카오가 막아두어 더 이상 동작 안 함.
// 대신 공식 Kakao Local REST API 의 주소 → 좌표 geocoding 을 활용:
//   - 사용자가 이름 + 주소를 직접 입력
//   - 주소를 /v2/local/search/address.json 으로 좌표 변환
//   - (선택) 카카오맵 url 도 같이 저장 → 디테일 패널의 외부 링크로 사용

import { getServerEnv } from '@/lib/env';

export type ManualPlaceLookupResult =
  | {
      ok: true;
      place: {
        place_name: string;
        road_address_name: string;
        address_name: string;
        x: string; // lng
        y: string; // lat
        place_url: string;
      };
    }
  | { ok: false; message: string };

interface KakaoAddressDoc {
  address_name: string; // 지번 fullname
  road_address?: { address_name: string } | null;
  x: string;
  y: string;
}
interface KakaoAddressResponse {
  documents?: KakaoAddressDoc[];
}

const PLACE_ID_REGEX = /\/(\d{4,})(?:\/?|\?|$)/;

function extractKakaoPlaceUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d{4,}$/.test(trimmed)) {
    return `https://place.map.kakao.com/${trimmed}`;
  }
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes('kakao.com')) return null;
    const m = u.pathname.match(PLACE_ID_REGEX);
    if (m) return `https://place.map.kakao.com/${m[1]}`;
    const itemId = u.searchParams.get('itemId');
    if (itemId && /^\d+$/.test(itemId)) {
      return `https://place.map.kakao.com/${itemId}`;
    }
    // 그 외 카카오맵 url 은 그대로 저장 (검증 통과)
    return trimmed;
  } catch {
    return null;
  }
}

interface LookupInput {
  name: string;
  address: string; // 도로명 또는 지번 주소
  kakaoUrl?: string; // 선택. 카카오맵 식당 페이지 url
}

export async function lookupPlaceManually(
  input: LookupInput,
): Promise<ManualPlaceLookupResult> {
  const name = input.name.trim();
  const address = input.address.trim();
  if (!name) return { ok: false, message: '식당 이름을 입력해주세요' };
  if (!address) return { ok: false, message: '주소를 입력해주세요' };

  const { kakaoRestKey } = getServerEnv();
  if (!kakaoRestKey) {
    return {
      ok: false,
      message: 'KAKAO_REST_KEY 가 설정 안 됨 — 관리자에게 문의해주세요',
    };
  }

  const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${kakaoRestKey}` },
      cache: 'no-store',
    });
  } catch (e) {
    return { ok: false, message: `geocoding 실패: ${(e as Error).message}` };
  }
  if (!res.ok) {
    return { ok: false, message: `geocoding HTTP ${res.status}` };
  }

  const json = (await res.json()) as KakaoAddressResponse;
  const first = json.documents?.[0];
  if (!first) {
    return {
      ok: false,
      message: '주소로 좌표를 못 찾았어요. 도로명 주소로 다시 시도해보세요',
    };
  }

  const lat = parseFloat(first.y);
  const lng = parseFloat(first.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: '좌표 파싱 실패' };
  }

  const placeUrl = input.kakaoUrl
    ? (extractKakaoPlaceUrl(input.kakaoUrl) ?? '')
    : '';

  return {
    ok: true,
    place: {
      place_name: name,
      road_address_name: first.road_address?.address_name ?? '',
      address_name: first.address_name ?? address,
      x: String(lng),
      y: String(lat),
      place_url: placeUrl,
    },
  };
}

// URL 만 입력받아 자동 파싱 — 카카오맵 식당 페이지의 HTML 을 fetch 해
// og:title / og:description / JSON-LD / 내부 script 에서 name + address 추출,
// 주소를 공식 geocoding 으로 좌표 변환. 모두 합치면 자동 prefill.
//
// HTML 파싱이라 카카오가 마크업 구조 살짝 바꾸면 깨질 수 있지만,
// og 태그는 SEO/공유 미리보기 때문에 카카오가 쉽게 안 뺄 가능성이 높음.

export async function parseKakaoPlaceFromUrl(
  input: string,
): Promise<ManualPlaceLookupResult> {
  const placeId = extractPlaceIdFromInput(input);
  if (!placeId) {
    return { ok: false, message: '카카오맵 url 또는 place 번호를 정확히 입력해주세요' };
  }

  const placeUrl = `https://place.map.kakao.com/${placeId}`;
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

  let html: string;
  try {
    const res = await fetch(placeUrl, {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return {
        ok: false,
        message: `카카오맵 페이지 응답 오류 (HTTP ${res.status}). place_id=${placeId}`,
      };
    }
    html = await res.text();
  } catch (e) {
    return { ok: false, message: `카카오맵 페이지 fetch 실패: ${(e as Error).message}` };
  }

  const name =
    matchMeta(html, 'og:title') ??
    matchMeta(html, 'twitter:title') ??
    null;

  // 주소 후보들 — og:description 은 종종 "맛집 ..." 같은 설명이라 주소만 있는 다른 후보도 같이
  const candidates = [
    matchInline(html, /"addrnewfullname"\s*:\s*"([^"]+)"/),
    matchInline(html, /"newaddrfullname"\s*:\s*"([^"]+)"/),
    matchInline(html, /"newaddr_fullname"\s*:\s*"([^"]+)"/),
    matchInline(html, /"address_name"\s*:\s*"([^"]+)"/),
    matchInline(html, /"addr"\s*:\s*"([^"]+)"/),
  ].filter(Boolean) as string[];
  const address = candidates[0] ?? matchMeta(html, 'og:description') ?? null;

  // 좌표 후보들 — 페이지 안에 lat/lng 이 보통 박혀있음
  const lat =
    matchInlineNum(html, /"lat"\s*:\s*"?(-?\d+\.\d+)"?/) ??
    matchInlineNum(html, /"latitude"\s*:\s*"?(-?\d+\.\d+)"?/) ??
    matchInlineNum(html, /"y"\s*:\s*"?(-?\d+\.\d+)"?/);
  const lng =
    matchInlineNum(html, /"lng"\s*:\s*"?(-?\d+\.\d+)"?/) ??
    matchInlineNum(html, /"longitude"\s*:\s*"?(-?\d+\.\d+)"?/) ??
    matchInlineNum(html, /"x"\s*:\s*"?(-?\d+\.\d+)"?/);

  if (!name) {
    return {
      ok: false,
      message: '식당 이름을 페이지에서 못 찾았어요. 직접 입력 모드를 사용해주세요',
    };
  }

  // 좌표 못 찾으면 주소로 geocoding fallback
  let finalLat = lat;
  let finalLng = lng;
  let roadAddress = '';
  let fullAddress = address ?? '';
  if (finalLat == null || finalLng == null) {
    if (!address) {
      return {
        ok: false,
        message: '좌표·주소 모두 못 찾았어요. 직접 입력 모드를 사용해주세요',
      };
    }
    const { kakaoRestKey } = getServerEnv();
    if (!kakaoRestKey) {
      return { ok: false, message: 'KAKAO_REST_KEY 미설정' };
    }
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${kakaoRestKey}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = (await res.json()) as KakaoAddressResponse;
      const first = json.documents?.[0];
      if (first) {
        finalLat = parseFloat(first.y);
        finalLng = parseFloat(first.x);
        roadAddress = first.road_address?.address_name ?? '';
        fullAddress = first.address_name ?? address;
      }
    }
    if (finalLat == null || finalLng == null) {
      return { ok: false, message: '좌표를 못 가져왔어요. 직접 입력 모드를 사용해주세요' };
    }
  }

  return {
    ok: true,
    place: {
      place_name: name,
      road_address_name: roadAddress,
      address_name: fullAddress,
      x: String(finalLng),
      y: String(finalLat),
      place_url: placeUrl,
    },
  };
}

function extractPlaceIdFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^\d{4,}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes('kakao.com')) return null;
    const m = u.pathname.match(PLACE_ID_REGEX);
    if (m) return m[1]!;
    const itemId = u.searchParams.get('itemId');
    if (itemId && /^\d+$/.test(itemId)) return itemId;
    return null;
  } catch {
    return null;
  }
}

function matchMeta(html: string, prop: string): string | null {
  const r1 = new RegExp(
    `<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const r2 = new RegExp(
    `<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  return html.match(r1)?.[1] ?? html.match(r2)?.[1] ?? null;
}

function matchInline(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function matchInlineNum(html: string, re: RegExp): number | null {
  const m = html.match(re);
  if (!m?.[1]) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

// 호환성: 기존 stub
export async function fetchKakaoPlaceFromUrl(): Promise<ManualPlaceLookupResult> {
  return {
    ok: false,
    message: '이 기능은 더 이상 동작하지 않습니다. parseKakaoPlaceFromUrl 또는 직접 입력 모드를 사용해주세요.',
  };
}
