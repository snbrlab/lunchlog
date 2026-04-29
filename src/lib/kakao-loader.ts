// 카카오맵 SDK 동적 로더 — Promise 기반 싱글톤.
// `?autoload=false` 라 SDK 로드 후 `window.kakao.maps.load(cb)` 까지 대기해야 사용 가능.

import { publicEnv } from './env';

let pending: Promise<void> | null = null;

export function loadKakaoMaps(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('loadKakaoMaps must run in browser'));
  }
  if (window.kakao?.maps?.load) {
    return new Promise((resolve) => window.kakao.maps.load(resolve));
  }
  if (pending) return pending;

  pending = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk]');
    const onLoad = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error('Kakao SDK loaded but maps namespace missing'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };

    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', () => reject(new Error('Kakao SDK script failed')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.dataset.kakaoSdk = 'true';
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(
      publicEnv.kakaoMapKey,
    )}&autoload=false&libraries=services`;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Kakao SDK script failed')), {
      once: true,
    });
    document.head.appendChild(script);
  });

  return pending;
}
