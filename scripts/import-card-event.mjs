// 카드사 "서울시 로컬브랜드 가맹점" 이벤트 데이터를 가져와서 card_event_merchants 에 채워넣는다.
// - 원본은 좌표/메뉴/가격이 없는 {name, type, address} 목록뿐이라 여기서:
//   1) 업종(type) 이 외식업인 것만 필터링
//   2) 카카오 REST API 로 지오코딩 (주소 자체가 지번/도로명이 섞여 정확도가 낮아 키워드검색을 씀)
//   3) 기존 restaurants 와 이름+거리로 자동 매칭 시도 (강한 매칭만 auto, 나머지는 admin 검수)
// 여러 번 다시 돌려도 안전 (event_id+district+name+address unique, reviewed/excluded 는 덮어쓰지 않음).
//
// Usage:
//   node --env-file=.env.local scripts/import-card-event.mjs

import { createClient } from '@supabase/supabase-js';

const EVENT_ID = '2026080030';
const EVENT_BASE_URL = `https://cdn.paybooc.co.kr/static/assets/images/etc/renew/event/2026/${EVENT_ID}`;

const DISTRICTS = [
  { code: 'gangbuk', label: '강북구(사일구로)', gu: '강북구' },
  { code: 'jungnang', label: '중랑구(상봉먹자골목)', gu: '중랑구' },
  { code: 'jung', label: '중구(광희로드)', gu: '중구' },
  { code: 'seongbuk', label: '성북구(성북동길)', gu: '성북구' },
  { code: 'seocho', label: '서초구(케미스트릿 강남역)', gu: '서초구' },
  { code: 'dongjak', label: '동작구(노량진 만나로)', gu: '동작구' },
  { code: 'dongdaemun', label: '동대문구(회기랑길)', gu: '동대문구' },
  { code: 'gwangjin', label: '광진구(건대 청춘잇길)', gu: '광진구' },
  { code: 'gwanak', label: '관악구(샤로수길)', gu: '관악구' },
  { code: 'gangseo', label: '강서구(마곡 미술길)', gu: '강서구' },
];

// 원본 174개 업종 중 "먹고 마시는" 곳만. 단란주점/유흥주점/위탁급식업은 회사 점심앱 성격상 제외.
const FOOD_CATEGORIES = new Set([
  '일반한식',
  '한정식',
  '서양음식',
  '일식·회집',
  '일식회집',
  '중국식',
  '중국음식',
  '스넥',
  '주점',
  '칵테일바',
  '제과점',
  '기타음료식품',
]);

const SUGGEST_RADIUS_M = 80;
const CONCURRENCY = 8;

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name} (node --env-file=.env.local scripts/import-card-event.mjs 로 실행해주세요)`);
    process.exit(1);
  }
  return v;
}

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY');
const kakaoRestKey = required('KAKAO_REST_KEY');

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeName(s) {
  return s.replace(/\s+/g, '').toLowerCase();
}

function haversineMeters(a, b) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, runner));
  return results;
}

async function kakaoKeywordSearch(query) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?${new URLSearchParams({ query, size: '5' })}`,
    { headers: { Authorization: `KakaoAK ${kakaoRestKey}` } },
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.documents ?? [];
}

async function kakaoAddressSearch(query) {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?${new URLSearchParams({ query })}`,
    { headers: { Authorization: `KakaoAK ${kakaoRestKey}` } },
  );
  if (!res.ok) return null;
  const json = await res.json();
  return json.documents?.[0] ?? null;
}

// 이름만으로 검색하면 전국 동명 매장이 잡힐 수 있어 구 이름을 붙여 우선 검색하고,
// 결과가 없으면 이름만으로 검색한 뒤 주소에 구 이름이 포함된 첫 결과를 채택한다.
// 그래도 못 찾으면(카카오맵에 장소로 등록 안 된 작은 가게) 원본 주소 문자열로 주소검색 fallback —
// 지저분한 주소(층/호, 괄호 동이름 섞인 것)도 꽤 잘 파싱됨 (실측 확인).
async function geocodeMerchant(name, gu, address) {
  const primary = await kakaoKeywordSearch(`${name} ${gu}`);
  if (primary.length > 0) return primary[0];

  const fallback = await kakaoKeywordSearch(name);
  const hit = fallback.find(
    (d) => (d.address_name ?? '').includes(gu) || (d.road_address_name ?? '').includes(gu),
  );
  if (hit) return hit;

  return await kakaoAddressSearch(address);
}

async function fetchDistrictMerchants(district) {
  const res = await fetch(`${EVENT_BASE_URL}_${district.code}.json`);
  if (!res.ok) throw new Error(`${district.code} fetch failed: ${res.status}`);
  const rows = await res.json();

  const seen = new Set();
  const merchants = [];
  for (const row of rows) {
    const category = row.type.trim();
    if (!FOOD_CATEGORIES.has(category)) continue;
    const name = row.name.trim();
    const address = row.address.trim();
    const key = `${name}|${address}`;
    if (seen.has(key)) continue; // 같은 매장이 업종 2개로 중복 등록된 경우 첫 번째만
    seen.add(key);
    merchants.push({ name, category, address });
  }
  return merchants;
}

async function loadExistingRestaurants() {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, name, latitude, longitude, kakao_place_url')
    .eq('is_closed', false);
  if (error) throw error;
  return data;
}

function findMatch(merchantName, lat, lng, restaurants) {
  const norm = normalizeName(merchantName);

  // 1) 이름이 정확히 같은 식당이 있으면 거리 상관없이 같은 곳으로 본다.
  //    (카카오 키워드검색 지오코딩이 부정확해서, "가장 가까운 식당"이 실제로는
  //    이름이 다른 엉뚱한 곳이고, 진짜 같은 이름 식당은 좀 더 멀리 잡히는 경우가 흔함 —
  //    거리로 먼저 좁히면 이런 진짜 매칭을 놓치게 돼서 이름 일치를 최우선으로 검사.)
  const exact = restaurants.find((r) => normalizeName(r.name) === norm);
  if (exact) {
    return { matched_restaurant_id: exact.id, match_confidence: 'auto' };
  }

  // 2) 이름이 정확히 같은 게 없으면, 가까운 거리 + 부분 일치로 후보만 제안.
  let best = null;
  let bestMeters = Infinity;
  for (const r of restaurants) {
    const meters = haversineMeters({ lat, lng }, { lat: r.latitude, lng: r.longitude });
    if (meters < bestMeters) {
      bestMeters = meters;
      best = r;
    }
  }
  if (
    best &&
    bestMeters <= SUGGEST_RADIUS_M &&
    (normalizeName(best.name).includes(norm) || norm.includes(normalizeName(best.name)))
  ) {
    return { matched_restaurant_id: best.id, match_confidence: 'suggested' };
  }
  return { matched_restaurant_id: null, match_confidence: 'none' };
}

// 지오코딩이 실패해 거리 비교를 못 하는 경우의 구제책 — 이름이 정확히 같은 식당이
// 런치로그에 이미 있으면 그 식당 좌표를 그대로 빌려써서 매칭 + 좌표 둘 다 해결.
function findExactNameMatch(name, restaurants) {
  const norm = normalizeName(name);
  return restaurants.find((r) => normalizeName(r.name) === norm) ?? null;
}

async function main() {
  console.log('기존 식당 목록 로드 중...');
  const restaurants = await loadExistingRestaurants();
  console.log(`  ${restaurants.length}개`);

  let totalUpserted = 0;
  let totalAuto = 0;
  let totalSuggested = 0;
  let totalGeocodeFailed = 0;

  for (const district of DISTRICTS) {
    console.log(`\n[${district.label}] 가맹점 목록 가져오는 중...`);
    const merchants = await fetchDistrictMerchants(district);
    console.log(`  외식업 ${merchants.length}개 → 지오코딩 시작 (동시 ${CONCURRENCY})`);

    // 재실행 안전장치: admin 이 이미 검수(reviewed=true) 한 항목은 건드리지 않음.
    const { data: reviewedRows } = await supabase
      .from('card_event_merchants')
      .select('name, address')
      .eq('event_id', EVENT_ID)
      .eq('district', district.code)
      .eq('reviewed', true);
    const reviewedKeys = new Set((reviewedRows ?? []).map((r) => `${r.name}|${r.address}`));

    const geocoded = await runPool(
      merchants,
      async (m) => {
        const doc = await geocodeMerchant(m.name, district.gu, m.address);
        return { ...m, doc };
      },
      CONCURRENCY,
    );

    const rows = geocoded.map((m) => {
      if (!m.doc) {
        // 카카오 검색은 실패했어도, 같은 이름의 식당이 런치로그에 이미 있으면
        // 그 식당 좌표를 빌려서 매칭 + 좌표를 한 번에 해결.
        const exact = findExactNameMatch(m.name, restaurants);
        if (exact) {
          totalAuto += 1;
          return {
            event_id: EVENT_ID,
            district: district.code,
            district_label: district.label,
            name: m.name,
            category: m.category,
            address: m.address,
            latitude: exact.latitude,
            longitude: exact.longitude,
            geocode_status: 'ok',
            matched_restaurant_id: exact.id,
            match_confidence: 'auto',
            // 런치로그에 이미 있는 식당이면 그 식당이 등록될 때 사람이 검증해둔
            // kakao_place_url(있다면)을 그대로 물려받음 — 리뷰/사진 있는 진짜 장소 페이지.
            kakao_place_url: exact.kakao_place_url ?? null,
          };
        }
        totalGeocodeFailed += 1;
        return {
          event_id: EVENT_ID,
          district: district.code,
          district_label: district.label,
          name: m.name,
          category: m.category,
          address: m.address,
          latitude: null,
          longitude: null,
          geocode_status: 'failed',
          matched_restaurant_id: null,
          match_confidence: 'none',
          kakao_place_url: null,
        };
      }
      const lat = Number(m.doc.y);
      const lng = Number(m.doc.x);
      const match = findMatch(m.name, lat, lng, restaurants);
      if (match.match_confidence === 'auto') totalAuto += 1;
      if (match.match_confidence === 'suggested') totalSuggested += 1;
      // 매칭된 기존 식당의 검증된 place_url 우선, 없으면 이번에 키워드검색으로 찾은
      // place_url(주소검색 fallback 결과엔 없음), 그것도 없으면 null.
      const matchedRestaurant = match.matched_restaurant_id
        ? restaurants.find((r) => r.id === match.matched_restaurant_id)
        : null;
      const kakaoPlaceUrl = matchedRestaurant?.kakao_place_url ?? m.doc.place_url ?? null;
      return {
        event_id: EVENT_ID,
        district: district.code,
        district_label: district.label,
        name: m.name,
        category: m.category,
        address: m.address,
        latitude: lat,
        longitude: lng,
        geocode_status: 'ok',
        kakao_place_url: kakaoPlaceUrl,
        ...match,
      };
    });

    // admin 이 이미 검수(reviewed=true) 한 항목은 재실행 때 덮어쓰지 않고 건너뜀.
    const toUpsert = rows.filter((r) => !reviewedKeys.has(`${r.name}|${r.address}`));
    const skipped = rows.length - toUpsert.length;

    if (toUpsert.length > 0) {
      const { error } = await supabase
        .from('card_event_merchants')
        .upsert(toUpsert, { onConflict: 'event_id,district,name,address' });
      if (error) {
        console.error(`  ✗ upsert 실패: ${error.message}`);
        continue;
      }
    }
    totalUpserted += toUpsert.length;
    const failed = toUpsert.filter((r) => r.geocode_status === 'failed').length;
    console.log(
      `  ✓ ${toUpsert.length}개 저장 (지오코딩 실패 ${failed}개)` +
        (skipped > 0 ? ` · 검수완료라 건너뜀 ${skipped}개` : ''),
    );
  }

  console.log('\n=== 완료 ===');
  console.log(`총 저장: ${totalUpserted}`);
  console.log(`자동 매칭(auto): ${totalAuto}`);
  console.log(`후보 매칭(suggested, admin 검수 필요): ${totalSuggested}`);
  console.log(`지오코딩 실패(수동 입력 필요): ${totalGeocodeFailed}`);
  console.log('\n/admin/card-event 에서 매칭 검수를 진행해주세요.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
