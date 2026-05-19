# 도메인 구매 / 배포처 이전 시 수정 가이드

> lunchlog 의 사이트 주소(도메인) 를 바꾸거나 배포처(Vercel → 다른 곳)를
> 옮길 때 **어디를 건드려야 하는지** 한 곳에 정리. 코드 변경은 거의 없고
> 대부분 외부 콘솔/환경변수 설정.

현재 기본 도메인: `https://lunchlog-rho.vercel.app`
(`lunchlog.vercel.app` 이 선점돼서 Vercel 이 `-rho` 접미사를 붙임)

---

## 1. 앱 코드 / 환경변수 (필수)

| 항목 | 위치 | 비고 |
|---|---|---|
| 사이트 베이스 URL | **Vercel → Settings → Environment Variables → `NEXT_PUBLIC_SITE_URL`** | 메일 CTA(`/log`, `/map`) 등 절대 URL 에 사용. 미설정 시 `src/lib/env.ts` 의 fallback (`lunchlog-rho.vercel.app`) 사용. **끝 슬래시 없이** 넣기 (예: `https://lunchlog.app`) |

- 코드상 사이트 URL 은 `publicEnv.siteUrl` **한 곳**에서만 읽음
  (`src/lib/env.ts`). 다른 파일에 하드코딩된 절대 URL 없음.
- 환경변수 추가/변경 후 **Vercel 재배포** 필요 (`NEXT_PUBLIC_*` 는 빌드 타임 인라인).

## 2. Supabase Auth (필수 — 안 하면 로그인/가입 깨짐)

Supabase 대시보드 → **Authentication → URL Configuration**

- **Site URL**: 새 도메인으로 변경
- **Redirect URLs** (allow list): 새 도메인의 콜백 경로 추가
  - `https://<새도메인>/auth/callback`
  - `https://<새도메인>/reset-password`
  - `https://<새도메인>/**` (와일드카드 허용 시 더 간단)
- **기존 URL 도 목록에 남겨두면** 전환 기간에 둘 다 동작 (안전)

> 이유: OTP 가입(D47) / 비번 재설정(D48) 이 위 경로로 리다이렉트.
> allow list 에 없으면 Supabase 가 리다이렉트 거부 → 흐름 깨짐.

## 3. Kakao Developers (필수 — 안 하면 지도 안 뜸)

[Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 →
앱 선택 → **플랫폼 → Web → 사이트 도메인**

- 새 도메인 추가 (`https://<새도메인>`)
- 기존 vercel 도메인도 같이 남겨두면 전환 중 안 깨짐

> 이유: 카카오맵 JS SDK 는 콘솔에 **등록된 도메인에서만** 로드됨.
> Kakao **REST** 키(geocoding/places, 서버 호출)는 referrer 검사 안 하므로 변경 불필요.

## 4. 도메인 등록처 → Vercel 연결 (도메인 새로 살 때만)

1. 도메인 구매 (Cloudflare Registrar / Porkbun / Gabia 등)
2. Vercel → 프로젝트 → **Settings → Domains → Add**
3. Vercel 이 안내하는 DNS 레코드 (A / CNAME) 를 등록처 DNS 에 입력
   - 또는 네임서버를 Cloudflare 로 옮겨 관리
4. 발급/검증 완료되면 위 1~3 (`NEXT_PUBLIC_SITE_URL`, Supabase, Kakao) 반영

## 5. 안 건드려도 되는 것

- `NEXT_PUBLIC_SUPABASE_URL`, anon key, `SUPABASE_SERVICE_ROLE_KEY` — 도메인 무관
- `KAKAO_REST_KEY` — 서버 호출, referrer 검사 없음
- `BREVO_API_KEY` / `BREVO_SENDER_EMAIL` — 발신 도메인이지 사이트 도메인 아님
  - (선택) 새 도메인 메일 평판을 위해 Brevo 에서 새 도메인 DKIM/SPF 인증은 별개로 가능
- Supabase 인증 쿠키 — host 기준 자동 스코프, 코드 변경 불필요

## 6. 배포처 자체를 옮길 때 (Vercel → 다른 PaaS/사내 서버)

- 위 1~3 그대로 (단, "Vercel 환경변수" → 새 배포처의 환경변수 설정 화면으로)
- Next.js 빌드/런타임 지원 호스트여야 함 (server actions, RSC 사용 중)
- proxy.ts(구 middleware) 동작 지원 확인 — 인증 가드가 여기 있음
- cron / 백그라운드 없음 (현재) — 별도 워커 이전 불필요
