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

> git 비유가 정체성: 리뷰=commit, 답글=branch, 식당 정정/병합=Pull Request, 활동량=잔디.

| 영역 | 내용 |
|---|---|
| 인증 | OTP 1회용 코드 가입 → ID/PW 로그인. **LG 그룹 + LX 그룹 30+ 도메인** 화이트리스트 |
| 지도 | 카카오맵 + 그룹별 이모지 핀, 픽셀 기반 클러스터링, 가까운 사옥 자동 매핑 (D72 7km cap) |
| 식당 | 카카오 검색 등록, cuisine 13그룹 70+세부, 술/인원/주소/place_url, 점심/저녁 다중 카테고리 |
| commit | 한 줄 = commit. 6자리 hash, 답글 (branch), revert, mention `@닉네임`, 이모지 reactions |
| 🏆 뱃지 | 30개 sticky 뱃지 (활동량/꾸준함/개척/다양성/시간대/cuisine 특화) + Steam 도감 |
| 👑 지역 대장 | 사옥별 commit 1위가 가져가는 롤링 왕관, 10 commit 컷, 자동 노티 |
| 🔀 Pull Request | 중복 식당 병합 + 식당 정보 수정 (이름/cuisine/주소/카카오 link/점심·저녁/등) 사용자 PR + admin 검토 |
| 🌱 잔디 | GitHub 식 활동 heatmap. 365일 commit 시각화 |
| 알림 | 🔔 헤더 드롭다운 (전체 + 미확인 카운트). 답글/멘션/뱃지/대장/PR 처리 |
| 공유 | 식당 카카오 공유 (URL + 한줄), `/me` 친구 초대 |
| Admin | 건물/식당/사용자/리뷰/제보/공지/뱃지/PR/대장 — 9개 탭 |
| 🖥️ 개발자 모드 | `/dev` 가상 터미널. ls / cd / git log / grep / find / cowsay / fortune 등 |
| 모바일 | 햄버거 사이드바, viewport-aware 패널, native share (카톡 등), safe-area |

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
4. Authentication → URL Configuration:
   - Site URL: `https://lunchlog-rho.vercel.app` (또는 본인 도메인)
   - Redirect URLs: `<위 url>/auth/callback` (현재는 미사용 — 추후 비번 reset 메일 흐름 위해)
5. Authentication → Sign In / Providers → Email: **Confirm Email = ON** 유지 (가입 신청 시 미승인 상태로 잡히게 하는 핵심)

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
| `ALLOWED_EMAIL_DOMAINS` | 가입 허용 도메인 (콤마 구분). LG/LX 계열 30+ 도메인 화이트리스트 |
| `BREVO_API_KEY` | (선택) Brevo transactional API — admin 전체메일 발송용 (D66) |
| `BREVO_SENDER_EMAIL` | (선택) Brevo 발신자 이메일 |
| `BREVO_SENDER_NAME` | (선택) Brevo 발신자 이름 (기본 '런치로그') |

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
| 건물 좌표 자동 보정 | `/admin/buildings` (지역별 + 카카오맵 링크 + 삭제) |
| 식당 일괄 관리 | `/admin/restaurants` (지역/URL 누락 필터, 폐업/삭제/병합/place_url 자동 보정) |
| cuisine 관리 | `/admin/cuisines` (그룹/세부 추가/수정) |
| 사용자 권한 / 비번 reset | `/admin/users` (admin 부여/회수, 임시비번 발급) |
| 리뷰 모아보기 | `/admin/reviews` (최근 100건 + 필터/검색 + 삭제) |
| 제보 처리 | `/admin/reports` (상태 + 댓글 ping-pong) |
| 🔀 PR 처리 | `/admin/pull-requests` (병합/적용/거부) |
| 👑 대장 명단 | `/admin/champions` (지역별 region champion 현황) |
| 공지 / 전체메일 | `/admin/announcements`, `/admin/broadcast` (Brevo) |

비밀번호 분실한 사용자가 메신저로 문의 → `/admin/users` 에서 해당 사용자의 **비번 reset** 버튼 클릭 → 화면에 1회만 표시되는 임시비번을 메신저로 직접 전달. 사용자는 임시비번으로 로그인 후 `/set-password` 로 강제 이동.

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
    layout.tsx                  # root + FOUC 방지 부트 (점심/저녁 mode)
    login / signup / onboarding / forgot-password / set-password / auth/callback
    (app)/                      # 인증/온보딩 끝난 사용자 영역 (Header + Toast + Banner)
      map/                      #   지도 + 사이드바 + 디테일 패널 (PR/공유 버튼 포함)
      restaurants/new           #   식당 등록 (카카오 검색 + 첫 리뷰)
      restaurants/[id]/edit     #   식당 수정
      me/                       #   마이페이지 (프로필, 잔디, 뱃지 도감, 친구 초대)
      u/[id]/                   #   다른 사용자 프로필 (받은 뱃지, 왕관)
      log/                      #   /log — review + PR 활동 통합 feed
      report/                   #   제보 (admin 과 ping-pong 댓글)
      dev/                      #   🖥️ 개발자 모드 가상 터미널 (D82)
      admin/                    #   관리자 영역 (9 탭)
        buildings / restaurants / cuisines / reviews / users / reports
        announcements / broadcast / champions / pull-requests
  components/
    Header.tsx                  # 좌 로고 / 중 점심·저녁 / 우 + 새맛집 / 🖥️ / 🔔 / 아바타
    NotificationBell.tsx        # 🔔 알림 모아보기 dropdown (D74)
    NotificationToast.tsx       # 도착 알림 토스트
    ShareButton.tsx             # 모바일 native share / 데스크탑 클립보드
    InviteFriendButton.tsx      # 친구 초대 (D81)
    AnnouncementBanner.tsx      # 공지 배너 (D59)
    ActivityHeatmap.tsx         # 🌱 잔디 (D52)
    CuisineLanguageBar.tsx      # cuisine 분포 비주얼
    badges/                     # BadgeCollection / BadgeChip / BadgeGrid / RegionCrown
    map/
      KakaoMap.tsx              # 지도 + 클러스터링 + 픽셀 기반 클러스터
      RestaurantSidebar.tsx     # 거리순 / 인기순 + cuisine + 점심·저녁 필터
      RestaurantDetailPanel.tsx # 식당 상세 + composer + ReviewLog + 공유/PR 버튼
      ReviewLog.tsx             # commit 로그 + revert/delete + reply + reactions
      ReviewComposer.tsx        # 한 줄 입력 + @멘션 typeahead + 인원/meal toggle
      ReactionBar.tsx           # 이모지 reaction bar (D79)
      OpenPullRequestModal.tsx  # PR 열기 모달 (병합/정보수정)
  lib/
    cuisine.ts                  # cuisine 그룹/세부 (DB 동기, source of truth)
    distance.ts                 # Haversine + 도보/차로 자동 분기
    badges.ts                   # 30 뱃지 메타데이터
    releases.ts                 # /about 릴리즈노트
    format-time.ts              # 상대 시간 + 어제/MM/DD fallback
    auth/                       # 도메인 화이트리스트 + requireAdmin
    cache/                      # offices / restaurants / reviews-log / cuisine-items / announcements
    supabase/                   # client / server / admin (service-role) 분리
    reviews/                    # actions + log fetcher
    restaurants/                # actions + detail fetcher
    favorites/ / meal-mode/ / heatmap/ / avatar-color/avatar-emoji
    admin/                      # 관리자 server actions
    pull-requests/              # PR — actions + fields descriptor + events fetcher
    dev/                        # 개발자 모드 — fs / commands / colors (D82)
  proxy.ts                      # 인증/온보딩/비번 가드
  types/db.ts                   # DB 인터페이스
supabase/migrations/            # SQL 마이그레이션 (번호 순서대로)
scripts/                        # CLI 백업 도구
```

## 진행 상태

1차 출시 후 운영. **D1 ~ D82** 완료. 자세한 내역은 [SPEC.md](./SPEC.md) + 앱 내 `/about` 릴리즈노트 참고.

최근 큼직한 변화:
- **D70**: 30개 뱃지 + 지역 대장 👑 롤링 왕관
- **D74**: 🔔 알림 모아보기 dropdown
- **D75**: `@닉네임` 멘션 typeahead + 알림
- **D77~D78**: 🔀 Pull Request 시스템 — 사용자 제안, admin 검토
- **D79**: commit emoji reactions 🎉
- **D80**: edit PR — 이름/cuisine/주소/카카오 link/술 여부/점심·저녁 등 모두 PR 로 수정
- **D81**: 식당 카톡 공유 + 친구 초대
- **D82**: 🖥️ 개발자 모드 — 가상 터미널 (`/dev`)

다음 예정 후보:
- 메뉴/식당 개인화 추천 (룰베이스 → 옵션으로 LLM)
- ❤️ 팔로우 (정적 관계, 노티 없음)
- 점심시간 reminder (슬랙/메일)
- dev 모드 Tab autocomplete + alias / pipes
