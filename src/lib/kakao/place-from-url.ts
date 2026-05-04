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

// 호환성: 기존 KakaoPlacesSearch 가 fetchKakaoPlaceFromUrl 을 import 하던 흔적 정리용
// (이제는 manual lookup 으로 대체)
export async function fetchKakaoPlaceFromUrl(): Promise<ManualPlaceLookupResult> {
  return {
    ok: false,
    message: '이 기능은 더 이상 동작하지 않습니다. 직접 입력 모드를 사용해주세요.',
  };
}
