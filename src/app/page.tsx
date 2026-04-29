import { redirect } from 'next/navigation';

// proxy.ts 에서 인증/온보딩에 따라 /login 또는 /onboarding 으로 보냄.
// 인증·온보딩 완료된 사용자가 / 로 직접 진입하면 /map 으로.
export default function Home() {
  redirect('/map');
}
