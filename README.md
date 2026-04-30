# 🍱 lunchlog

사내 동료들끼리 맛집을 공유하는 지도 웹서비스. 결정사항/데이터모델 자세한 명세는 [SPEC.md](./SPEC.md).

배포본: https://lunchlog-rho.vercel.app

## 스택

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 (CSS-first config)
- Supabase (Postgres + Auth)
- 카카오맵 JS SDK + Places REST API (admin 도구용)
- Vercel 배포

## 핵심 기능

| 영역 | 내용 |
|---|---|
| 인증 | OTP (8자리 코드) 회원가입/로그인 + ID/PW 로그인 (회사 메일 Outlook Safe Links 회피용) |
| 지도 | 카카오맵 위 흰 배경 + 그룹별 이모지 핀, 회사 위치 표시, 점심/저녁 모드별 색상 |
| 식당 | 카카오 검색 기반 등록, cuisine 13그룹 70+세부, 술가능, 추천인원, 카카오 place_url |
| 리뷰 | "한 줄 = commit" 모델. 6자리 hash, party_size, 점심/저녁 토글, revert (24h) |
| 거리 | Haversine. 도보 20분 이하 🚶 / 초과 🚗 자동 분기 |
| Admin | `/admin` 대시보드. 건물 좌표 자동 보정, 식당 일괄 관리, 사용자 권한, 제보 처리 |
| 제보 | `/report` 폼 (버그/기능/식당/기타). admin 이 상태 관리 + 메모 |
| 모바일 | 햄버거 사이드바, viewport-aware 디테일 패널, safe-area 지원 |

## 처음 셋업

### 1. 로컬 의존성

```bash
npm install
```

### 2. Supabase 프로젝트 생성

1. https://supabase.com 에서 새 프로젝트 생성 (region: Northeast Asia / Seoul 권장)
2. SQL Editor 에서 `supabase/migrations/` 의 SQL 파일을 **번호 순서대로 모두** 실행
3. Project Settings → API 에서 키 복사:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon public → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role → `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 절대 클라이언트 노출 금지)
4. Authentication → Email Templates → **Magic Link** 템플릿 수정:
   - URL (`{{ .ConfirmationURL }}`) 부분 모두 제거
   - `{{ .Token }}` 만 남겨 8자리 코드로 발송 (D30 — Outlook Safe Links 회피, token length 는 Auth 설정에서 8 로)
5. Authentication → URL Configuration:
   - Site URL: `https://lunchlog-rho.vercel.app` (또는 본인 도메인)
   - Redirect URLs: `<위 url>/auth/callback`

### 3. 카카오 디벨로퍼스

1. https://developers.kakao.com 에서 앱 생성
2. **플랫폼 → Web** 에 도메인 등록 (`http://localhost:3000`, vercel 도메인 둘 다)
3. **앱 키** 페이지에서:
   - **JavaScript 키** → `NEXT_PUBLIC_KAKAO_MAP_KEY` (지도 SDK)
   - **REST API 키** → `KAKAO_REST_KEY` (admin 의 좌표/place_url 자동 보정)

### 4. 환경변수

```bash
cp .env.example .env.local
# .env.local 채우기
```

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project url |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (클라용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role (서버 전용, admin 작업) |
| `NEXT_PUBLIC_KAKAO_MAP_KEY` | 카카오 JS SDK 키 |
| `KAKAO_REST_KEY` | 카카오 REST API 키 (admin 자동 보정용. 선택) |
| `ALLOWED_EMAIL_DOMAINS` | 가입 허용 도메인 (콤마 구분). 1차: `lge.com` |

### 5. 개발 서버

```bash
npx next dev   # npm run dev 도 OK. Windows 에선 종료 시 좀비 프로세스 주의
```

### 6. 첫 관리자 지정

본인이 가입한 후 Supabase SQL Editor 에서:

```sql
update users set role = 'admin' where email = '본인이메일@lge.com';
```

이후 헤더 아바타 → ⚙️ 관리자 진입 가능.

## 운영 시 admin 작업

| 작업 | 위치 |
|---|---|
| 건물 좌표 자동 보정 | `/admin/buildings` → 🪄 자동 보정 (KAKAO_REST_KEY 필요) |
| 식당 일괄 관리 | `/admin/restaurants` (폐업/삭제, place_url 자동 보정) |
| 사용자 권한 | `/admin/users` (admin 부여/회수) |
| 제보 처리 | `/admin/reports` (상태 + 메모) |
| 사용자 신규 가입 / 비번 재설정 | `scripts/admin-create-user.mjs`, `scripts/admin-set-password.mjs` |

매직링크가 막힌 환경 (Outlook Safe Links) 에서 동료 가입시키려면:

```bash
node --env-file=.env.local scripts/admin-create-user.mjs you@lge.com '임시비번' 표시이름
```

## 배포 (Vercel)

1. GitHub repo 생성 + push
2. Vercel → New Project → 레포 import
3. Environment Variables 에 `.env.local` 의 6개 변수 모두 등록 (Production + Preview)
4. Deploy
5. **외부 시스템에 도메인 등록 필수:**
   - 카카오 디벨로퍼스 → 플랫폼 → Web 도메인 추가
   - Supabase → Authentication → URL Configuration 갱신

## 디렉토리 구조

```
src/
  app/
    layout.tsx              # root layout + FOUC 방지 부트 스크립트 (점심/저녁 mode)
    error.tsx / loading.tsx # 전역 에러 / 로딩 fallback
    login/                  # OTP + ID/PW 로그인
    onboarding/             # 사무실/건물/이모지 선택
    set-password/           # 매직링크 가입 후 비번 강제 설정
    auth/callback/          # 매직링크 콜백 (호환용)
    (app)/                  # 인증/온보딩 끝난 사용자 영역 (헤더 공통)
      layout.tsx            #   Header + MealModeProvider
      map/                  #   지도 + 사이드바 + 디테일 패널
      restaurants/new/      #   식당 등록 (카카오 검색 + 첫 리뷰)
      restaurants/[id]/edit/#   식당 수정 (카카오 재검색으로 좌표/주소 갱신 가능)
      me/                   #   마이페이지 (프로필/비번 변경 + 내 commit)
      report/               #   관리자에게 제보 (D32)
      ranking/              #   랭킹 (D36, UserMenu 에선 숨김)
      admin/                #   관리자 영역 (D24)
        layout.tsx          #     admin 가드 + 탭 네비
        page.tsx            #     대시보드
        buildings/          #     건물 좌표 자동/수동 보정
        restaurants/        #     식당 일괄 (폐업/삭제/place_url 보정)
        users/              #     사용자 권한 토글
        reports/            #     제보 상태/메모 처리
  components/
    Header.tsx              # 좌 로고 / 중 점심·저녁 토글 (/map 만) / 우 + 새맛집 + 아바타
    MealModeToggle.tsx      # 점심/저녁 슬라이드 토글
    UserMenu.tsx            # 아바타 드롭다운 (마이페이지/제보/admin/로그아웃)
    EmojiPicker.tsx         # 120개 이모지 그리드 (4 카테고리)
    map/
      KakaoMap.tsx          # 지도 + 핀 + 회사 마커 + 경로 + 줌/위치 버튼
      KakaoPlacesSearch.tsx # 카카오 키워드 검색 (식당 등록/수정)
      RestaurantSidebar.tsx # 거리순 식당 리스트 + 그룹 필터칩
      RestaurantDetailPanel.tsx
      ReviewLog.tsx         # commit 로그 + revert/delete
      ReviewComposer.tsx    # 한 줄 입력창 + 인원 + 점심/저녁 토글
  lib/
    env.ts                  # 환경변수 런타임 검증
    cuisine.ts              # cuisine 13그룹 70+세부 source of truth
    distance.ts             # Haversine + 도보/차로 자동 분기
    avatar-color.ts         # 이름 해시 → 파스텔 배경
    avatar-emoji.ts         # 이름 해시 → 120개 이모지 풀
    hash.ts                 # commit hash 6자리
    format-time.ts          # 상대 시간 ("3분 전", "어제")
    kakao-loader.ts         # 카카오 SDK Promise 로더
    meal-mode/              # 점심/저녁 Context (localStorage 동기)
    auth/                   # 도메인 화이트리스트 + signOut
    supabase/               # client / server / proxy 분리
    reviews/actions.ts      # createReview / deleteReview / revertReview
    restaurants/actions.ts  # update / toggleClosed
    admin/                  # 관리자 server actions (좌표 보정/권한/제보)
  proxy.ts                  # 인증/온보딩/비번 가드 (Next 16 proxy convention)
  types/
    db.ts                   # DB 인터페이스
    kakao-maps.d.ts         # 카카오맵 SDK 타입
supabase/
  migrations/               # SQL (번호 순서대로 실행)
scripts/
  admin-create-user.mjs     # 매직링크 우회 신규 가입
  admin-set-password.mjs    # 비번 강제 재설정
```

## 진행 상태

1차 출시 후 운영 단계. Phase 1~9 + 다수 미니 페이즈 완료 (D1~D37). [SPEC.md](./SPEC.md) 의 결정사항 표 참고.

다음 예정:
- D37 멤버 등급 (점수 → 브론즈/실버/골드 등) → 도입 후 D36 랭킹 공개
- 실 데이터 운영 중 보강 (시드 정리, UI 다듬기)
