'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// / 진입 시 client-side 에서 /map 으로 보냄. proxy.ts 가 인증 안 됐으면 /login 으로 다시 보냄.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/map');
  }, [router]);
  return null;
}
