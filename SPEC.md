# lunchlog — 개발 명세서

> 사내 동료들끼리 맛집을 공유하는 지도 웹서비스
> 본 문서는 **Claude Code 또는 AI 코딩 에이전트가 즉시 구현 가능한 수준**의 명세서임. 추측이 아닌 결정된 사항만 기록.

---

## 0. 빠른 컨텍스트

**무엇**: 회사 동료끼리만 쓰는 맛집 지도 웹서비스
**핵심 차별점**:
1. 점심/저녁 토글이 라이트/다크 테마 전환과 결합됨
2. 한 줄 리뷰가 깃 커밋 로그처럼 시간순으로 쌓임
3. 사용자 사무실/건물 좌표 기준 도보 거리/경로 자동 계산

**스택**: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · 카카오맵 JS SDK · Vercel 배포

**출시 범위**: 마곡 / 여의도 / 평택 사무실. 다중 사무실 데이터 모델은 D1 부터 정착 — 사용자 본인 office 내 식당만 노출. office 스위처 UI 는 추후 (PLAN L6).

---

## 1. 결정사항 (확정)

확정된 결정사항이며, 구현 시 임의로 변경 금지.

| # | 항목 | 결정 |
|---|---|---|
| D1 | 인증 방식 | 회사 이메일 도메인 화이트리스트만 가입 가능 (게스트 모드 없음) |
| D2 | 식당 카테고리 | `lunch` / `dinner` 다중 선택 가능 (둘 다 가능한 식당 존재) |
| D3 | 음식 종류 | `cuisine_types` 필드 (다중, 1개 이상 필수, D39 에서 단일 → 배열로 변경). 13개 그룹 × 70+ 세부 항목. 단일 source = `lib/cuisine.ts` 의 `CUISINE_GROUPS`. (D27/D39 갱신) |
| D4 | 추천메뉴 | `menu_tags` 필드 (다중, 선택). cuisine_types 와 별개의 자유 태그 |
| D5 | 리뷰 작성 권한 | 누구나 작성 가능. 방문 여부 검증하지 않음 (메모/위시리스트성 글도 허용) |
| D6 | 같은 작성자 연속 리뷰 | ~~최근 1개만 펼쳐 노출 + "이전 N개 더보기"로 접기~~ → **그룹화 안 하고 모두 펼쳐 노출** (운영 중 사용자 결정으로 보강) |
| D7 | 점심/저녁 리뷰 분리 | 각 리뷰는 `meal_time: 'lunch' | 'dinner'` 가짐. 작성 시 사용자가 토글로 선택 (기본값: 현재 탭) |
| D8 | 디테일 패널 리뷰 필터 | `점심(N) / 저녁(N) / 전체(N)` 토글로 분리/통합 보기 가능. 기본값은 현재 탭 |
| D9 | 폐업 처리 | `is_closed` boolean. 표시는 되지만 회색 + ✕ 마커. 리뷰는 보존. **토글은 admin 만 가능 (D25 보강)** |
| D10 | 거리 계산 | 사용자 등록 건물 좌표 ↔ 식당 좌표. Haversine 직선거리 / 67m × 1분 |
| D11 | 경로 표시 | 카카오맵 Polyline으로 직선 또는 ㄱ자 라인. 도보 길찾기 API는 1차 미적용 |
| D12 | 다중 사무실 | DB 모델은 미리 마련. 1차는 마곡 본부만 운영. 사무실 스위처 UI는 미구현 |
| D13 | 가입 플로우 | 첫 로그인 시 사무실(office) + 건물(building) 선택 필수 |
| D14 | 퇴사자 리뷰 | 마스킹/삭제 없이 그대로 유지 |
| D15 | 알림/슬랙봇 | 1차 미구현 |
| D16 | 사진 업로드 | 1차 미구현 |
| D17 | 별점 | 사용 안 함 (한 줄 리뷰가 곧 평가) |
| D18 | 검색 노출 차단 | 인증 게이트로 충분. 추가로 `noindex` meta 및 `robots.txt` 설정 |
| D19 | 한 줄 리뷰 길이 | 최대 200자 |
| D20 | 리뷰 수정 | 본인 작성 후 24시간 이내만 가능. 이후엔 수정/삭제 불가 (커밋 보존) |
| D21 | 추천 인원 | `recommended_min_size`, `recommended_max_size` (둘 다 nullable, 둘 다 set 또는 둘 다 null). 등록 폼에서 선택 입력. 1차엔 표시만 (필터 미구현) |
| D22 | 프로필 이모지 | `users.avatar_emoji` (nullable). 풀 120개 (동물 40 / 음식 40 / 표정 24 / 사물 16, `lib/avatar-emoji.ts`). NULL 이면 이름+id 해시로 자동 배정. 픽커는 온보딩 + 마이페이지 |
| D23 | 비밀번호 인증 | 회사 메일이 사내망 전용이라 매직링크 단독으로는 외부망 사용 불가. `users.password_set boolean` 추가. **D38 이후로는** 가입 시점에 사용자가 직접 비번 설정 → `password_set: true` 로 시작. admin 이 임시비번 reset 하면 `password_set: false` 가 되며 `/set-password` 로 강제 |
| D24 | 관리자 역할 | `users.role text default 'member' check (role in ('member','admin'))`. RLS 정책에 `is_admin()` 함수 박아 admin 우회. 첫 admin 은 `update users set role='admin' where email=...` 로 직접 |
| D25 | 폐업 토글 권한 | **admin only**. SPEC 초안의 "등록자 또는 24h commit 한 사람" 보다 좁힘. UI 도 admin 만 토글 버튼 노출 |
| D26 | 리뷰 방문 인원 | `reviews.party_size int` (nullable, 1~99). 작성 폼에서 선택 입력. 표시 시 `👥N` |
| D27 | cuisine 그룹 분류 | 13개 그룹 (한식/일식/중식/양식/아시아/고기/해산물/치킨/피자/카페·디저트/술집/뷔페/기타) × 항목 70+개. `lib/cuisine.ts` 의 `CUISINE_GROUPS` 가 단일 source. 사이드바 필터는 그룹 라벨로, 등록 폼은 그룹별로 칩 묶어 노출 |
| D28 | 술 가능 여부 | `restaurants.has_alcohol boolean default false`. 음식 종류와 직교(orthogonal) — 일식+술 / 한식+술 등 표현 가능. 사이드바 `🍺 술 가능만` 토글, 디테일 패널 식당명 옆 🍺 표시 |
| D29 | 식당 정보 수정 | 등록자 본인 또는 admin 만 수정 가능. `/restaurants/[id]/edit` 페이지에서 이름/좌표/주소/카테고리/cuisine/menu_tags/가격대/추천인원/술가능/비고/카카오 url 변경. 좌표/주소는 카카오 재검색으로 갱신 가능 (D29 보강) |
| D30 | ~~OTP 인증~~ → admin 승인 가입으로 폐기 (D38) | OTP 흐름은 회사 메일 게이트웨이 / SMTP rate limit / Outlook Safe Links 등 외부 의존성 문제 누적으로 D38 에서 admin 승인 모델로 대체. 매직링크/8자리 코드 흐름 모두 폐기 |
| D31 | 카카오 place_url | `restaurants.kakao_place_url` 추가. 등록 시 카카오 places 검색 결과의 place_url 저장 → 디테일 패널의 외부 링크가 식당 상세 페이지 (리뷰/메뉴) 로 연결. admin 페이지에서 누락분 자동 보정 가능 |
| D32 | 사내 제보 시스템 | `reports` 테이블 + `/report` 폼 (카테고리 4개: 버그/기능/식당/기타) + `/admin/reports` 처리 페이지. 상태 (open/reviewing/resolved) + admin 메모. RLS: 본인+admin read, admin update/delete |
| D33 | 식당 등록자 표시 | 디테일 패널 (lg 이상) 에 `등록: {이모지} {이름}` 표시. 모바일은 hidden (공간 최적화) |
| D34 | 도보 / 차로 자동 분기 | 도보 20분 이하면 🚶 도보, 초과면 🚗 차로 표시. 차로 환산 = 30km/h ≈ 500m/min. 사이드바/디테일패널/지도뱃지 모두 적용 |
| D35 | 리뷰 revert vs delete | 일반 사용자: 본인 글을 **언제든 revert** 가능 (DB 행 보존, 화면에 strikethrough + REVERTED 라벨 → history 유지). admin: **delete** 가능 (DB 행 완전 제거). RLS update 24h 제약 제거 (D20 보강), delete 정책은 admin only |
| D36 | 랭킹 (비공개) | `/ranking` 페이지에 인기 식당 / 활동러 / 최근 7일 핫함 / cuisine 분포 4섹션. 활동 점수 = 리뷰 1점 + 식당 등록 5점. **현재 UserMenu 에서 숨김** (`/ranking` url 직접 진입은 가능) — 추후 멤버 등급 기능 도입 후 공개 |
| D37 | 멤버 등급 (TODO) | D36 의 점수 기반으로 추후 도입 예정. 브론즈/실버/골드 같은 등급 + 마이페이지/디테일패널에 배지 표시 |
| D38 | admin 승인 가입 | OTP/메일 인프라 의존성을 제거. 사용자는 `/signup` 에서 이메일+이름+비번 입력 → `auth.users` 가 `email_confirm: false` 로 미리 생성되고 `signup_requests` row pending 상태. admin 이 `/admin/signups` 에서 승인하면 `email_confirmed_at` 세팅 + `users` 프로필 행 생성 (`password_set: true`). 거절 시 auth user 삭제 + `signup_requests.status='denied'`. 비번 분실은 admin 이 `/admin/users` 에서 임시비번 발급 → 사용자가 임시비번으로 로그인 시 `/set-password` 강제 |
| D39 | cuisine 다중 선택 | 한일퓨전 등 여러 cuisine 그룹 걸치는 곳을 위해 `cuisine_type text` → `cuisine_types text[]` 로 전환. 등록/수정 폼에서 다중 선택 가능 (1개 이상 필수). 사이드바 그룹 필터는 배열 overlap 으로 매칭. 50m 중복 검사도 `.overlaps()` 로. 기존 `cuisine_type` 컬럼은 rollback 안전망으로 보존, gin 인덱스 `idx_restaurants_cuisines` 신규 |
| D40 | 브랜치 commit | git branch-out 메타포: `reviews.parent_review_id uuid references reviews(id)` 로 다른 commit 에 대한 답글 commit 작성 가능. 1-level 만 (답글의 답글 금지 — server action 단계에서 강제). 디테일 패널 ReviewLog: 각 root commit 옆 `↪ reply` 버튼 → composer 가 reply mode 로 전환 → 메시지 입력 후 commit 하면 부모 아래 들여쓰기 + `↳` 마커로 표시. /log 페이지엔 답글 줄에 `↳ {부모 hash} · {부모 작성자} 의 commit 에 답글` 한 줄 추가. on delete set null 로 부모 삭제 시 자식은 root 로 격하 |
| D41 | 인앱 노티 | `notifications` 테이블 + DB 트리거로 자동 생성. 4 케이스: (1) admin 이 사용자 제보 status/admin_note 업데이트 → 제보자에게 노티, (2) 사용자 commit 에 답글 commit 달림 → 부모 작성자에게 노티 (본인이 본인 글에 답글이면 skip), (3) 새 가입 신청 → 모든 admin 에게 노티, (4) 새 제보 → 모든 admin 에게 노티. 트리거 함수는 `security definer` 로 RLS 우회. `(app)` 영역 layout 에 `NotificationToast` 마운트 — 페이지 로드 시 미확인 노티 fetch → 우측 하단 스택으로 표시. ✕ 또는 카드 클릭 시 `read_at` 채우고 토스트 제거. payload 는 jsonb 로 type 별 정보 저장 (denormalized snapshot) |
| D42 | egress / 쿼리 최적화 | (1) `bump_restaurant_commit_stats` 트리거가 INSERT/DELETE 외에 UPDATE (revert flip) 까지 처리 → `restaurants.commit_count` 가 항상 활성 리뷰 수와 일치. /map 매 로드마다 reviews 전수 카운트하던 쿼리 제거. (2) `offices` / `office_buildings` 는 `lib/cache/offices.ts` 의 `unstable_cache` (24h, service-role 클라) 로 묶고, admin 의 좌표 보정/자동 보정 시 `invalidateOfficesCache()` 로 즉시 무효화. (3) /map restaurants `select *` → 사용 컬럼만 명시 (egress 절감). (4) `/ranking`, `/me` 의 식당 링크 → `/map?focus={id}` 로 갱신 (D40 의 focus param 와이어업 활용) |
| D43 | 식당 가시성 cross-office | 기존엔 /map 에서 `eq('office_id', user.office_id)` 로 본인 사무실 식당만 보였음. 거리는 본인 건물 좌표 기준으로 계산되니 다른 사무실 동료가 등록한 식당도 다 보여야 일관됨 (예: 마곡 사용자가 여의도 근처 출장 가서 식사). `restaurants.office_id` 는 "누가 처음 등록했냐" 메타데이터로 남기되 가시성 필터에서는 제거. 50m 중복 검사도 office 무관하게 적용 — 다른 사무실 사람이 이미 등록한 식당 또 등록하는 것 차단. (`/ranking` 은 그대로 office-scoped — "내 사무실 통계" 의미 유지) |
| D44 | 찜 (favorites) | `favorites (user_id, restaurant_id, created_at)` 테이블, PK 두 컬럼으로 중복 방지. RLS: 본인 row 만 read/insert/delete. 디테일 패널 헤더에 ☆/★ 토글 버튼 (낙관적 UI: 즉시 반영 + 서버 비동기). 사이드바 카드 식당명 옆엔 시각적 ★ 만 (별도 토글 X — 정보 밀도 부담). 마이페이지에 "⭐ 찜한 곳" 섹션: 찜한 식당 목록 + cuisine + commit 수 + 찜한 시간, 식당명 클릭 시 `/map?focus=id` |
| D45 | 직접 입력 fallback 등록 | 카카오 Local API (keyword search) 에 indexing 안 된 식당 등록용. 처음엔 비공식 endpoint `place.map.kakao.com/main/v/{id}` 시도했으나 카카오가 막아둠 (404). 두 단계 fallback: (1) URL 자동 파싱 — 카카오맵 식당 페이지 HTML 을 fetch 해 og:title + 내부 script 정규식으로 name/lat/lng/addr 추출, 좌표 못 찾으면 주소 geocoding fallback. (2) 직접 입력 — 사용자가 이름/도로명 주소 직접 타이핑, 주소는 공식 `/v2/local/search/address.json` 으로 좌표 변환. KakaoPlacesSearch 하단의 두 details 섹션에서 노출 |
| D46 | /log 작성자 근무지 필터 | 동료들이 어디 가는지 사무실별로 보고 싶을 때 사용. /log 의 LogList 에 office chip 필터 추가 — 전체/마곡/여의도/평택. reviews fetch 시 author.office_id 같이 가져오고, offices 는 캐시된 목록 (D42) 활용. 클라이언트에서 row.author.office_id 매칭으로 필터링 |
| D47 | OTP 가입 부활 (Brevo SMTP) | D38 admin 승인 흐름이 admin 손이 너무 많이 가서 OTP 자동 가입으로 회귀. Brevo Custom SMTP 로 lge.com 메일 발송 검증 완료 → Supabase Auth → Emails → SMTP 에 Brevo 연결 (smtp-relay.brevo.com:587). 흐름: /signup 에서 이메일+닉네임 입력 → `signInWithOtp({ data: { name } })` 로 user_metadata 에 닉네임 임시 저장 → 메일에 6~8자리 코드 발송 → 같은 페이지에서 코드 입력 → `verifyOtp` 후 users 행 자동 생성 (메타데이터의 닉네임 사용) → /onboarding (사무실/건물/이모지) → /set-password → /map. D38 의 signup_requests 테이블 / `/admin/signups` / `signup_request_new` 노티는 코드/DB 보존하되 admin nav 에서 숨김 — 롤백 가능 |

---

## 2. 데이터 모델 (Supabase / Postgres)

### 2.1 `offices`
지역 단위 사무실. 마곡/강남/창원 등.

```sql
create table offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,           -- "마곡" / "여의도" / "평택"
  slug text unique not null,    -- "magok"
  default_lat double precision not null,
  default_lng double precision not null,
  created_at timestamptz default now()
);
```

### 2.2 `office_buildings`
하나의 사무실에 속한 건물들. 정확한 좌표를 가짐.

```sql
create table office_buildings (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references offices(id) on delete cascade,
  name text not null,           -- "A동", "본관"
  latitude double precision not null,
  longitude double precision not null,
  display_order int default 0,
  created_at timestamptz default now()
);
```

### 2.3 `users`
Supabase Auth의 `auth.users`를 확장하는 프로필 테이블.

```sql
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  department text,
  office_id uuid references offices(id),
  building_id uuid references office_buildings(id),
  avatar_color text not null,                 -- hex 문자열, 가입 시 자동 생성
  avatar_emoji text,                          -- D22, NULL 이면 이름 해시로 자동
  role text not null default 'member'
        check (role in ('member','admin')),   -- D24
  password_set boolean not null default false, -- D23
  created_at timestamptz default now()
);
```

`office_id`/`building_id`는 가입 직후 모달에서 입력받기 때문에 NOT NULL 제약 없이 두되, 입력 전엔 메인 화면 진입 차단 (가드). `password_set` 도 가드 단계에 포함 (false 면 `/set-password` 강제).

### 2.4 `restaurants`

```sql
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  categories text[] not null,           -- ['lunch'], ['dinner'], ['lunch','dinner']
  cuisine_types text[] not null,        -- D3/D27/D39, 배열. 각 원소가 lib/cuisine.ts 의 ALL_CUISINES 중 하나
  menu_tags text[] default '{}',        -- 추천메뉴 자유 태그
  price_level int not null check (price_level between 1 and 3),
  latitude double precision not null,
  longitude double precision not null,
  address text not null,
  note text,
  office_id uuid references offices(id),  -- 1차는 마곡 고정
  is_closed boolean default false,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  -- D21 추천 인원 (둘 다 set or 둘 다 null)
  recommended_min_size int,
  recommended_max_size int,
  -- D28 술 가능 (음식 종류와 직교)
  has_alcohol boolean not null default false,
  -- D31 카카오 places 의 place_url (등록 시 저장 → 외부 링크에 사용)
  kakao_place_url text,
  -- denormalized for sort/display
  commit_count int default 0,
  last_commit_at timestamptz,
  constraint restaurants_recommended_size_check check (
    (recommended_min_size is null and recommended_max_size is null)
    or (recommended_min_size is not null and recommended_max_size is not null
        and recommended_min_size between 1 and 99
        and recommended_max_size between 1 and 99
        and recommended_min_size <= recommended_max_size)
  )
);

create index idx_restaurants_office on restaurants(office_id);
create index idx_restaurants_categories on restaurants using gin(categories);
```

### 2.5 `reviews`
한 줄 리뷰 = 커밋.

```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  author_id uuid not null references users(id),
  message text not null check (char_length(message) <= 200),
  meal_time text not null check (meal_time in ('lunch','dinner')),
  party_size int check (party_size is null or (party_size between 1 and 99)), -- D26
  hash text not null,                   -- 6자리, 클라이언트 생성 후 저장
  reverted boolean not null default false, -- D35
  created_at timestamptz default now(),
  edited_at timestamptz
);

create index idx_reviews_restaurant_time on reviews(restaurant_id, created_at desc);
```

### 2.6 `signup_requests` (D38)
admin 승인 가입 흐름의 큐. `/signup` 제출 시 row 생성, admin 이 `/admin/signups` 에서 처리.

```sql
create table signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  auth_user_id uuid not null,                     -- email_confirm:false 로 미리 만든 auth.users.id
  status text not null default 'pending'
    check (status in ('pending','approved','denied')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id) on delete set null,
  denied_reason text
);
-- 한 이메일당 동시에 하나의 pending (denied/approved 후 재신청은 가능)
create unique index uniq_signup_pending_email on signup_requests(email) where status = 'pending';
```

RLS: admin only (read/write). 일반 사용자는 직접 못 본다 — `/signup` 의 `requestSignup` server action 이 service-role 키로 처리.

### 2.7 RLS (Row Level Security)
모든 테이블에 RLS 활성화. `is_admin()` 함수로 admin 우회 (D24).

- 모든 read: 인증된 사용자(authenticated role)만
- `restaurants` insert: 인증된 사용자, `created_by = auth.uid()`
- `restaurants` update: `created_by = auth.uid()` **또는 admin** (D29)
- `restaurants` delete: **admin only**
- `reviews` insert: 인증된 사용자, `author_id = auth.uid()` 강제
- `reviews` update/delete: `author_id = auth.uid() AND created_at >= now() - interval '24 hours'` (D20) **또는 admin**
- `users` update: 본인 행. `role` 변경은 admin 만 (D24)
- `offices` / `office_buildings` write: admin only

⚠️ `is_closed` 토글은 RLS 가 아닌 server action 단계에서 admin 검증 (D25). RLS 가 owner update 를 허용하므로 server action 만 안전 진입점으로 둠.

### 2.8 트리거
리뷰 추가/삭제 시 `restaurants.commit_count`, `last_commit_at` 자동 갱신.

---

## 3. 환경변수

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# 카카오맵
NEXT_PUBLIC_KAKAO_MAP_KEY=

# 가입 허용 도메인 (콤마 구분)
ALLOWED_EMAIL_DOMAINS=회사.com,계열사.com
```

도메인 검증은 Supabase Edge Function (Auth Hook) 또는 회원가입 직후 서버 액션에서 검사.

---

## 4. 라우팅 구조

```
/                            → 인증 시 /map으로 리다이렉트, 미인증 시 /login
/login                       → 이메일+비번 로그인
/signup                      → 가입 신청 (이메일+이름+비번 → admin 승인 대기, D33)
/auth/callback               → OAuth 콜백 (현재 미사용, 비번 reset 메일 위해 보존)
/onboarding                  → 승인 후 사무실/건물/이모지 선택 (가드)
/set-password                → 비번 미설정 사용자 강제 진입 (admin 임시비번 reset 후, D23/D33)
/map                         → 메인. 점심/저녁 토글 + 식당 리스트 + 지도 + 디테일 패널
/restaurants/new             → 새 식당 등록 + 첫 한 줄 리뷰
/restaurants/[id]/edit       → 식당 수정 (owner 또는 admin, D29)
/me                          → 마이페이지 (이름/이모지/부서/건물 변경 + 비번 변경 + 내 commit 목록)
/report                      → 관리자에게 제보 (D32)
/ranking                     → 랭킹 (D36, UserMenu 에선 숨김. url 직접 진입)
/admin/*                     → 관리자 영역 (대시보드/buildings/restaurants/reviews/users/signups/reports)
```

Next 16 의 `proxy.ts` (구 `middleware.ts`) 로 가드. 단계: 인증 → 온보딩(office/building) → 비번 설정(password_set) → /map.

---

## 5. UI 사양

### 5.1 헤더 (인증된 영역 고정)
- 좌측: 로고 + "우리회사 맛집지도" (모바일은 "맛집지도")
- 중앙: 점심/저녁 토글 (테마 동시 전환)
- 우측: `+ 새 맛집` 링크 + 사용자 아바타(이모지) → 드롭다운 (마이페이지, 로그아웃)
- 모바일 (< lg): 사이드바는 햄버거 토글로 좌측 슬라이드 (지도 좌상단 ☰ 버튼)

### 5.2 점심/저녁 토글 동작
- 클릭 시 0.4s transition으로 라이트↔다크 전환
- 동시에 식당 리스트가 해당 카테고리로 필터링 (`categories` 배열에 해당 값 포함되는 것만 노출)
- 마지막 선택은 `localStorage.lastMealMode`에 저장
- 리뷰 작성 시 기본값으로도 사용

### 5.3 테마 토큰

| 토큰 | 점심 (라이트) | 저녁 (다크) |
|---|---|---|
| 배경 | `#ffffff` | `#0f0f0f` |
| 표면 | `#fafaf7` | `#161616` |
| 본문 텍스트 | `#1a1a1a` | `#f5f3ec` |
| 보조 텍스트 | `#5f5e5a` | `#b4b2a9` |
| 활성 핀 | `#1a1a1a` | `#f0997b` |
| 비활성 핀 | `#888780` | `#7f77dd` |
| 경로 라인 | `#1a1a1a` 점선 | `#f0997b` 점선 |
| 회사 마커 | `#e24b4a` | `#e24b4a` |
| commit 신선 (7일 내) | `#1a9e75` | `#5dcaa5` |
| commit 오래됨 | `#888780` | `#888780` |

### 5.4 메인 화면 (`/map`) 레이아웃
2단 그리드: 좌측 사이드바 280px, 우측 메인.

**사이드바**
- 라벨: `SORTED BY DISTANCE` + 식당 개수
- 필터 칩 (전체/한식/일식/...): `cuisine_type` 기준
- 식당 카드 (거리 가까운 순):
  - 좌측에 분 단위 큰 숫자 (`14px / 500`)
  - 오른쪽에 식당명 + 거리(m) + commit 수 + 가격대(₩₩)

**메인 영역**
- 상단: 카카오맵 (회사 마커 + 식당 핀들 + 선택된 식당 경로 라인)
- 하단: 디테일 패널

**디테일 패널 구조 (위→아래)**
1. 경로 정보 바 (배경: `#f5f3ec` 라이트 / `#262626` 다크)
   - `■ 회사 → ● [식당명]` · `도보 N분` · `약 Nm`
2. 식당 헤더: `#번호  [식당명]  [가격대]  [commit수]`
3. cuisine_type 표시 (큰 칩 1개) + menu_tags (작은 칩 다수)
4. `REVIEW LOG` 섹션
   - 우측에 필터 토글: `[점심 N] [저녁 N] [전체 N]` (D8)
   - 좌측 세로선 + 동그라미 점 (최근 7일 = `commit신선` / 이전 = 회색)
   - 각 항목: `해시(6자리, mono)` + 작성자명 + 시간 + ☀/☾ 아이콘 + 한 줄 메시지
   - 같은 작성자 연속 리뷰는 최근 1개만 노출, 나머지는 `▾ 박지민의 이전 리뷰 3개 더보기` (D6)
5. 하단 입력창
   - `[한 줄 리뷰...]` `[☀|☾ 토글]` `[commit]` 버튼
   - meal_time 토글 기본값: 현재 화면 모드와 동일 (D7)

### 5.5 시간 표기
- 1시간 이내: `방금` / `N분 전`
- 24시간 이내: `N시간 전`
- 7일 이내: `어제` / `N일 전`
- 그 이후: `MM/DD`

### 5.6 폐업 식당 표시
- 핀: 회색 + ✕ 오버레이
- 사이드바 카드: 식당명에 strikethrough + "폐업" 배지
- 디테일 패널: 상단에 노란 띠 "폐업한 식당입니다"
- 검색/필터에서 기본 제외, 필터에 "폐업 포함" 옵션 추가

---

## 6. 핵심 함수 시그니처 (참고)

```typescript
// lib/distance.ts
export function haversineDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number;

export function metersToWalkMinutes(meters: number): number;
// 1m / 67m * 60s, Math.max(1, Math.round(...))

// lib/hash.ts
export function generateCommitHash(): string; // 6자리 hex

// lib/time.ts
export function formatRelativeTime(date: Date): string;
// "방금" | "5분 전" | "3시간 전" | "어제" | "3일 전" | "10/15"

// lib/theme.ts
export type MealMode = 'lunch' | 'dinner';
export function getThemeTokens(mode: MealMode): ThemeTokens;
```

---

## 7. 가입 / 온보딩 플로우

1. `/login`에서 회사 이메일 입력 → 매직 링크 발송
2. 메일 링크 클릭 → 콜백에서 도메인 검증
   - 허용 도메인 외 → 즉시 `signOut` + 에러 페이지
3. `users` 테이블에 row 없으면 → `/onboarding` 강제 리다이렉트
4. `/onboarding` 모달 (스킵 불가):
   - 표시 이름 (이메일에서 자동 추정)
   - 사무실: 드롭다운 (1차는 "마곡 본부"만)
   - 건물: 사무실 선택 후 노출되는 드롭다운
   - (선택) 부서
5. 저장 후 `/map`으로 이동
6. `users.avatar_color`는 사용자명 기반 해시로 자동 생성 (예: pastel 컬러 팔레트에서 선택)

---

## 8. 식당 등록 플로우

1. `/map` 우상단 `+ 새 맛집` 버튼 또는 `/restaurants/new`
2. 카카오맵 키워드 검색 (Places API) → 결과 클릭 시 자동 입력
   - 이름, 좌표, 주소
3. 사용자 입력
   - 카테고리 (점심/저녁 다중)
   - cuisine_type (단일, 필수)
   - menu_tags (다중, 선택, 자유 입력)
   - 가격대 ₩/₩₩/₩₩₩
   - 비고 (선택)
4. 첫 한 줄 리뷰 작성 (필수, 등록자가 첫 commit 작성자)
   - meal_time 토글 (기본값: 현재 탭)
5. 좌표 50m 이내 동일 cuisine_type 식당 존재 시 모달:
   - "혹시 [기존 식당]과 같은 곳인가요? [같은 곳] [다른 곳]"
6. 저장 → 사이드바 리스트에 즉시 노출

---

## 9. 안 만들 것 (Out of Scope, 1차)

명시적으로 1차에서 제외. 구현 욕심 금지.

- 사진 업로드
- 별점/평점
- 댓글/대댓글
- 알림 시스템
- 슬랙 봇
- 게스트 모드
- 사무실 스위처 UI (DB는 다중 사무실 대비, UI는 단일)
- 도보 길찾기 API (직선거리만)
- 잔디형 commit 그래프
- 익명 리뷰
- 좋아요 / 즐겨찾기
- 푸시 알림 / 이메일 알림

**1차에 들어간 (out of scope 였다가 포함됨):**
- 검색 (식당명 + menu_tags) — 사이드바 상단 입력으로
- 회식/혼밥 데이터 — `recommended_min/max_size` (D21) + `reviews.party_size` (D26) + `has_alcohol` (D28). 필터 UI 는 `🍺 술 가능만` 만 있고 인원 필터는 미구현

이 목록의 항목 요청이 와도 "1차 out of scope"로 명시하고 진행 금지.

---

## 10. Phase별 작업 체크리스트

### Phase 1 — 골격 셋업
- [x] Next.js 14 (App Router) + TypeScript + Tailwind 프로젝트 초기화
- [x] Supabase 프로젝트 생성, 마이그레이션 작성 (섹션 2 SQL)
- [x] RLS 정책 적용 (섹션 2.6)
- [x] 환경변수 세팅 (`.env.example` 작성, 섹션 3)
- [x] 미들웨어로 인증 가드 + 온보딩 가드
- [x] Vercel 배포 파이프라인

### Phase 2 — 인증 & 온보딩
- [x] `/login` 매직 링크
- [x] 콜백에서 도메인 화이트리스트 검증
- [x] `/onboarding` 사무실/건물 선택 모달
- [x] `users` 프로필 생성 + `avatar_color` 자동 생성
- [x] 시드 데이터: `offices`(마곡 본부) + `office_buildings`(A동/B동/...)

### Phase 3 — 점심/저녁 모드 + 테마
- [x] 헤더 컴포넌트 (로고 + 토글 + 아바타)
- [x] 점심/저녁 토글 → `data-mode` 속성 또는 context
- [x] Tailwind dark mode 클래스로 테마 토큰 매핑 (섹션 5.3)
- [x] `localStorage.lastMealMode` 저장/복원
- [x] 토글 0.4s 트랜지션

### Phase 4 — 지도 & 식당 표시
- [x] 카카오맵 SDK 연동 (`/map` 페이지)
- [x] 식당 핀 렌더링 (모드별 색상)
- [x] 사용자 건물 좌표를 회사 마커로 표시
- [x] Haversine 거리 계산 + 정렬
- [x] 좌측 사이드바 식당 리스트
- [x] 사이드바 cuisine_type 필터 칩

### Phase 5 — 식당 디테일 & 경로
- [x] 핀/카드 클릭 시 디테일 패널 업데이트
- [x] 카카오맵 Polyline으로 경로 라인 (직선 또는 ㄱ자)
- [x] 경로 중간에 도보 시간 뱃지
- [x] 경로 정보 바 (회사 → 식당, 시간/거리)

### Phase 6 — 리뷰 시스템
- [x] 리뷰 목록 (commit 로그 UI, 세로선 + 점 + 해시)
- [x] 리뷰 작성 (입력창 + meal_time 토글 + commit 버튼)
- [x] 클라이언트에서 6자리 hash 생성
- [x] `[점심 N] [저녁 N] [전체 N]` 필터 토글
- [x] 같은 작성자 연속 리뷰 묶기 (`▾ 더보기`)
- [x] 24시간 이내 본인 리뷰만 수정/삭제 가능
- [x] 시간 상대 표기 함수

### Phase 7 — 식당 등록
- [x] `/restaurants/new` 페이지 또는 모달
- [x] 카카오맵 Places API 검색 연동
- [x] 입력 폼 (카테고리/cuisine_type/menu_tags/가격대/비고)
- [x] 첫 리뷰 동시 작성
- [x] 50m 이내 중복 체크 모달

### Phase 8 — 보조 기능
- [x] 마이페이지 (`/me`): 건물 변경, 내 작성 리뷰 목록
- [x] 폐업 처리 UI (식당 등록자 또는 자기 commit 24시간 내인 사람만 토글 가능)
- [x] 폐업 식당 회색 표시 + 노란 띠
- [x] 검색 (식당명, menu_tags)
- [x] `noindex` meta + `robots.txt`

### Phase 9 — 마무리
- [x] 모바일 반응형 (사이드바 → 하단 시트로)
- [x] 빈 상태 UI (식당 0개일 때 안내)
- [x] 에러 바운더리
- [x] 로딩 스켈레톤
- [x] README (실행 방법, 환경변수 설명, 시드 데이터 투입 방법)

---

## 11. 코드 컨벤션

- TypeScript strict mode
- 서버 컴포넌트 우선, 인터랙션 필요 시만 `'use client'`
- DB 접근은 `lib/supabase/server.ts` (서버) / `lib/supabase/client.ts` (클라이언트) 분리
- 공유 타입은 `types/db.ts` (Supabase CLI로 자동 생성한 타입 활용)
- Tailwind 유틸리티 우선, 반복되는 패턴만 컴포넌트화
- 한국어 UI 텍스트는 `lib/strings.ts`에 모아두기 (i18n 대비, 구현은 안 함)
- 에러는 throw가 아닌 `Result<T, E>` 반환 패턴 권장 (서버 액션)

---

## 12. 시드 데이터 (개발용)

`offices`:
- 마곡 (37.5604, 126.8255)
- 여의도 (37.5266, 126.9279)
- 평택 (37.0625, 127.0586)

`office_buildings`:
- 마곡: W1~W10, ISC, E1~E14
- 여의도: LG트윈타워
- 평택: LG디지털파크

`restaurants` 샘플 5개 (테마 확인용):
- 하동관 본점 (lunch, 한식, 곰탕, ₩₩)
- 미진 (lunch, 한식, 메밀국수, ₩)
- 교다이야 (lunch+dinner, 일식, 스시, ₩₩₩)
- 본가 (dinner, 삼겹살, 회식, ₩₩)
- 오무라안 (dinner, 술집, 이자카야, ₩₩)

---

## 13. 작업자(Claude Code)에게 전달

이 명세서는 결정사항만 기록함. **명세서에 명시되지 않은 것은 임의 결정 금지하고 질문할 것.** 특히 다음 항목은 반드시 확인 후 진행:

1. 마곡 본부 건물의 정확한 좌표/이름 (시드 데이터 채우기 전에 사용자 제공 필요)
2. 허용 이메일 도메인 실제 값
3. Supabase 프로젝트 / 카카오맵 앱 키 발급 방법 (사용자가 직접 발급, 키만 전달)
4. 1차 출시 후 운영 중 폐업/오등록 데이터 정리 정책 (현재 명세는 사용자가 self-flag만 가능)

명세서 외 결정이 필요할 때는 코드를 작성하기 전에 질문할 것. 모호함을 해결하지 않은 채로 가정해 진행하지 말 것.
