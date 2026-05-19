// 환경변수 로더 — 누락 시 시작 단계에서 즉시 실패
// 클라이언트에서 접근하는 값(NEXT_PUBLIC_*)과 서버 전용 값을 분리한다.

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  kakaoMapKey: required('NEXT_PUBLIC_KAKAO_MAP_KEY', process.env.NEXT_PUBLIC_KAKAO_MAP_KEY),
};

export function getServerEnv() {
  return {
    supabaseServiceRoleKey: required(
      'SUPABASE_SERVICE_ROLE_KEY',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    allowedEmailDomains: required('ALLOWED_EMAIL_DOMAINS', process.env.ALLOWED_EMAIL_DOMAINS)
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    // admin 의 카카오 REST API 호출용 (선택. 없으면 자동 좌표 보정 비활성)
    kakaoRestKey: process.env.KAKAO_REST_KEY ?? null,
    // D66: 전체메일 다이제스트용 Brevo transactional API (선택).
    // 없으면 /admin/broadcast 발송 비활성.
    brevoApiKey: process.env.BREVO_API_KEY ?? null,
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL ?? null,
    brevoSenderName: process.env.BREVO_SENDER_NAME ?? '런치로그',
  };
}
