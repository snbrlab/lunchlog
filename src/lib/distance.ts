// 두 지점 간 직선 거리 (Haversine, 미터). SPEC 5.6 / D10.

const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineDistanceMeters(from: LatLng, to: LatLng): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)));
  return EARTH_RADIUS_M * c;
}

// SPEC D10: 67m × 1분 환산. 최소 1분.
export function metersToWalkMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 67));
}

// 차량 환산 (도시 평균 30km/h ≈ 500m/min)
export function metersToCarMinutes(meters: number): number {
  return Math.max(1, Math.round(meters / 500));
}

// 도보 20분 이하면 도보, 초과면 차량으로 표시.
export function travelInfo(meters: number): {
  mode: 'walk' | 'car';
  minutes: number;
  icon: string;
  label: string;
} {
  const walk = metersToWalkMinutes(meters);
  if (walk <= 20) {
    return { mode: 'walk', minutes: walk, icon: '🚶', label: '도보' };
  }
  const car = metersToCarMinutes(meters);
  return { mode: 'car', minutes: car, icon: '🚗', label: '차로' };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
