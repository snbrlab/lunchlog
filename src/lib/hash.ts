// 6자리 hex commit hash (SPEC 2.5 의 reviews.hash). 클라이언트 생성.
// 충돌 가능성 있지만 표시용/식별용이라 OK.

export function generateCommitHash(): string {
  // crypto.getRandomValues 가 안전. SSR 시 fallback 으로 Math.random.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(3);
    crypto.getRandomValues(buf);
    return Array.from(buf)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}
