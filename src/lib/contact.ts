// 문의처 이메일 — 로그인 없이도 닿아야 하는 약관/처리방침에서 사용.
// 개인 이메일이 공개 repo 에 박히지 않게 env 로 주입 (Vercel: NEXT_PUBLIC_CONTACT_EMAIL).
// 미설정 시 빈 문자열 → 페이지에서 이메일 줄을 숨기고 앱 내 문의만 안내.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '';
