'use server';

// 카카오 Places API (keyword search) 에 잡히지 않는 식당 우회 등록.
// 카카오맵 (place.map.kakao.com) 의 비공식 JSON endpoint 활용 — UI 에 보이는 모든 식당 cover.
// ⚠️ 비공식 — 카카오가 응답 형식 바꾸거나 차단하면 깨질 수 있음. P18 영업시간 기능과 동일 endpoint.

export type FetchPlaceResult =
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

const PLACE_ID_REGEX = /\/(\d{4,})(?:\/?|\?|$)/;

function extractPlaceId(input: string): string | null {
  const trimmed = input.trim();
  // 그냥 숫자만 입력한 경우도 허용
  if (/^\d{4,}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes('kakao.com')) return null;
    // place.map.kakao.com/27260928, m.place.map.kakao.com/27260928
    const pathMatch = u.pathname.match(PLACE_ID_REGEX);
    if (pathMatch) return pathMatch[1]!;
    // map.kakao.com/?itemId=27260928
    const itemId = u.searchParams.get('itemId');
    if (itemId && /^\d+$/.test(itemId)) return itemId;
    return null;
  } catch {
    return null;
  }
}

interface KakaoPlaceJson {
  basicInfo?: {
    placenamefull?: string;
    cid?: string | number;
    address?: {
      newaddrfullname?: string;
      addrbunho?: string;
      newaddr?: { newaddrfull?: string };
      region?: { fullname?: string };
      addrnewfull?: string;
    };
    feedback?: { kakaomapUrl?: string };
    // 좌표 — 문서화 안 됐지만 보통 위치 정보가 어딘가에
    coordinate?: { x?: string | number; y?: string | number };
  };
}

export async function fetchKakaoPlaceFromUrl(input: string): Promise<FetchPlaceResult> {
  const placeId = extractPlaceId(input);
  if (!placeId) {
    return {
      ok: false,
      message: '카카오맵 url 또는 place 번호를 정확히 입력해주세요',
    };
  }

  let res: Response;
  try {
    res = await fetch(`https://place.map.kakao.com/main/v/${placeId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; lunchlog/1.0; +https://lunchlog-rho.vercel.app)',
        Referer: 'https://place.map.kakao.com/',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch (e) {
    return { ok: false, message: `카카오맵 fetch 실패: ${(e as Error).message}` };
  }

  if (!res.ok) {
    return { ok: false, message: `카카오맵 응답 오류 (HTTP ${res.status})` };
  }

  let json: KakaoPlaceJson;
  try {
    json = (await res.json()) as KakaoPlaceJson;
  } catch {
    return { ok: false, message: '카카오맵 응답을 JSON 으로 파싱하지 못했어요' };
  }

  const b = json.basicInfo;
  if (!b) {
    return { ok: false, message: 'basicInfo 누락 — 폐업했거나 비공개 식당일 수 있어요' };
  }

  const name = b.placenamefull?.trim();
  if (!name) {
    return { ok: false, message: '식당 이름을 가져오지 못했어요' };
  }

  // 좌표는 비공식 endpoint 응답 구조가 종종 변하니 여러 후보 시도
  const lat =
    typeof b.coordinate?.y === 'string'
      ? parseFloat(b.coordinate.y)
      : typeof b.coordinate?.y === 'number'
        ? b.coordinate.y
        : NaN;
  const lng =
    typeof b.coordinate?.x === 'string'
      ? parseFloat(b.coordinate.x)
      : typeof b.coordinate?.x === 'number'
        ? b.coordinate.x
        : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: '좌표를 가져오지 못했어요 (응답 구조 변경 가능성)' };
  }

  // 도로명 주소 우선, 없으면 fullname
  const roadAddress =
    b.address?.newaddr?.newaddrfull ?? b.address?.newaddrfullname ?? '';
  const fullAddress = b.address?.addrnewfull ?? b.address?.region?.fullname ?? '';

  return {
    ok: true,
    place: {
      place_name: name,
      road_address_name: roadAddress,
      address_name: fullAddress,
      x: String(lng),
      y: String(lat),
      place_url: b.feedback?.kakaomapUrl ?? `https://place.map.kakao.com/${placeId}`,
    },
  };
}
