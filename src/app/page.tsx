import { redirect } from 'next/navigation';

// D65: / → /map 서버 리다이렉트.
// 이전엔 client-side useEffect 라 첫 방문 시 빈 페이지 + JS hydrate + 재이동으로
// round-trip 한 번이 통째로 낭비됐음. proxy.ts 가 이미 인증 가드 (미인증 → /login)
// 하므로 여기선 서버에서 즉시 /map 으로.
export default function Home() {
  redirect('/map');
}
