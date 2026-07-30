// 카카오 도메인 화이트리스트 — 사용자 입력 URL 을 kakao 도메인으로만 제한 (stored-XSS/피싱 방지).
export function isAllowedKakaoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'place.map.kakao.com' || u.hostname.endsWith('.kakao.com');
  } catch {
    return false;
  }
}
