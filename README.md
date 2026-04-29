# 🍱 lunchlog

사내 동료들끼리 맛집을 공유하는 지도 웹서비스. 자세한 명세는 [SPEC.md](./SPEC.md).

## 스택

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 (CSS-first config)
- Supabase (Postgres + Auth)
- 카카오맵 JS SDK
- Vercel 배포

> SPEC 에는 Next 14 로 기술돼 있으나 `create-next-app@latest` 가 16 을 설치했고 기능 차이가 작아 그대로 진행. 필요 시 다운그레이드 가능.

## 처음 셋업

### 1. 로컬 의존성

```bash
npm install
```

### 2. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트 생성
2. SQL Editor 에서 `supabase/migrations/` 의 SQL 파일을 **번호 순서대로** 실행
   - `20260429000001_init_schema.sql`
   - `20260429000002_triggers.sql`
   - `20260429000003_rls.sql`
   - `20260429000004_seed.sql`
3. Project Settings → API 에서 키 3종 확인
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 클라이언트 노출 금지)

### 3. 카카오맵 키 발급

1. https://developers.kakao.com 에서 앱 생성
2. 플랫폼 → Web → 사이트 도메인에 `http://localhost:3000` 및 운영 도메인 등록
3. JavaScript 키 → `NEXT_PUBLIC_KAKAO_MAP_KEY`

### 4. 환경변수

```bash
cp .env.example .env.local
# .env.local 채우기
```

`ALLOWED_EMAIL_DOMAINS` 는 가입 허용 도메인 (콤마 구분). 1차는 `lge.com`.

### 5. 개발 서버

```bash
npm run dev
```

### 6. 첫 관리자 지정

가입 후 Supabase SQL Editor 에서:

```sql
update users set role = 'admin' where email = '본인이메일@lge.com';
```

`role = 'admin'` 인 사용자는 RLS 우회로 모든 식당/리뷰 수정·삭제 가능 (폐업 처리, 오등록 정리용).

## 배포 (Vercel)

1. GitHub 에 push
2. Vercel → New Project → 이 레포 선택
3. Environment Variables 에 `.env.local` 의 5개 변수 모두 등록
4. Deploy

Vercel 은 Next.js 를 자동 감지하므로 `vercel.json` 불필요.

## 디렉토리 구조

```
src/
  app/                  # App Router 페이지
  lib/
    env.ts              # 환경변수 검증 로더
    supabase/
      client.ts         # 브라우저 클라이언트
      server.ts         # 서버 컴포넌트/액션 클라이언트
      proxy.ts          # Edge proxy 헬퍼 (세션 갱신)
  proxy.ts              # 인증/온보딩 가드 (Next 16 proxy convention)
supabase/
  migrations/           # SQL 마이그레이션 (번호 순)
public/
  robots.txt            # noindex (사내 전용이라 검색 차단)
```

## 진행 상태

Phase 1 (골격 셋업) 완료. Phase 2 (인증/온보딩)부터 이어서 작업.
