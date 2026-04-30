# lunchlog — 개선 / 백로그

[SPEC.md](./SPEC.md) 의 D1~D42 구현 후 운영 단계에서 떠오른 개선 idea 정리.
우선순위는 변동 가능. 작업 시 SPEC 의 D 항목으로 승격하며 옮긴다.

## 🎯 빠른 임팩트 (우선)

| # | 항목 | 작업량 | 비고 |
|---|---|---|---|
| P1 | **랜덤 추천** ("오늘 뭐 먹지?" 🎲 버튼) | 작음 | 사이드바 상단. mode + cuisine 필터 적용 후 랜덤 1개 선택 |
| P2 | **등록 후 그 식당 자동 selected** | 작음 | `/restaurants/new` 후 `/map?focus=ID` 로 redirect. (D40 의 focus param 와이어업 이미 있음) |
| P3 | **첫 로드 bounds fit** | 작음 | 식당 좌표들의 LatLngBounds → `map.setBounds()`. 회사 마커 포함 |
| P4 | **핀 클러스터링** | 중간 | 식당 늘어나면 핀 겹침. 카카오맵 Clusterer 라이브러리 또는 자체 grouping (zoom level 따라) |
| P5 | **즐겨찾기 ⭐** | 중간 | `favorites` 테이블 (`user_id`, `restaurant_id`, `created_at`). 사이드바에 즐겨찾기 탭 추가 |

## ✨ 디테일 / UX

| # | 항목 | 비고 |
|---|---|---|
| P6 | 카카오맵 모바일 길찾기 url | 디테일 패널의 외부 링크를 `https://map.kakao.com/link/to/...` 로 → 모바일에서 카카오맵 앱 자동 열림 |
| P7 | 사이드바 카드 한 줄 컴팩트화 | 🚶 + 분 + min 3줄 → 1줄 |
| P8 | 디테일 패널 slide-up transition (모바일) | 현재 쨘 등장. CSS transition 0.2s |
| P9 | 핀 hover 라벨 가독성 | 핀 빽빽할 때 라벨 겹침. 선택 시만 라벨 표시로 단순화 |
| P10 | 회사 마커 디자인 정돈 | 현재 빨간 알약 + 🏢. 사용자가 처음 "안 예쁘다" 했음 |

## 🛡️ 운영 / 보안

| # | 항목 | 비고 |
|---|---|---|
| P11 | **시드 정리 일괄** | 본인 admin 으로 `/admin/buildings` 자동 보정 + 임시 식당 검수 |
| P12 | **욕설 / 스팸 필터** | 단순 키워드 차단 + 작성 rate limit (1분 5건 등) |
| P13 | **place_url 검증** ✅ | 사용자가 임의 url 박는 거 차단 (kakao 도메인만) — D38 로 승격 작업 완료 |
| P14 | **Vercel Analytics** | 무료 plan. 사용량 / 페이지뷰 모니터링 |
| P15 | **에러 추적 (Sentry 등)** | 사용자 늘면 추가 |
| P16 | **백업** | Supabase 자동 백업 + 주간 SQL dump |
| P17 | **데이터 export** | 사용자 본인 commit JSON 다운로드 (마이페이지) |
| P18 | **영업시간 자동 채우기** | 카카오 비공식 endpoint `https://place.map.kakao.com/main/v/{placeId}` 의 `basicInfo.openHour` 활용. 이미 보유한 `kakao_place_url` 에서 placeId 추출. admin 페이지에 "영업시간 자동 채우기" 버튼 (좌표/place_url 자동 보정 패턴 따름). 스키마는 `opening_hours text` (간단) 또는 `jsonb` (요일별 + "지금 영업 중" 뱃지 가능). ⚠️ 비공식 API — 깨질 시 fallback 으로 카카오 링크 노출. 대안: Google Places API (공식, 결제카드 필요, 무료 티어 충분) |

## 🚀 큰 작업 (later)

| # | 항목 | 비고 |
|---|---|---|
| L1 | **D37 멤버 등급** | 점수 (D36) → 브론즈/실버/골드. 마이페이지/디테일패널 배지. 등급 도입 후 D36 랭킹 공개 |
| L2 | **사진 업로드** (SPEC out-of-scope 였음) | Supabase Storage. 식당 1장 + 리뷰 1장 |
| L3 | **알림** | admin 답변, 즐겨찾기 식당 새 commit 등 |
| L4 | **회식 모드** | recommended_size 4+ 또는 has_alcohol 한 번에 필터 |
| L5 | **그룹 회식 추천** | 멤버 N 명 입력 → 적합한 식당 자동 추천 |
| L6 | **타 사무실 식당 보기** | 다중 사무실 운영 시 office 스위처 |
| L7 | **슬랙 봇 / 메신저 통합** | 새 식당 등록 알림 등 |
| L8 | **commit 댓글** | 한 줄 리뷰에 짧은 reply |
| L9 | **이번 주 핫함 다이제스트 메일** | 주간 자동 메일 |

## 🧹 코드 / 기술 부채

| # | 항목 | 비고 |
|---|---|---|
| T1 | Supabase types 자동 생성 (`supabase gen types typescript`) | 현재는 `types/db.ts` 수동 |
| T2 | 모든 server action `unknown` 캐스트 정리 | join 타입 추론 깨지는 곳 헬퍼로 |
| T3 | Tailwind CSS 변수 토큰 SPEC 5.3 와 동기 검증 | 가끔 변경되니 자동화 |
| T4 | 마이그레이션 Supabase CLI 자동화 | 현재는 SQL Editor 수동. `supabase db push` |
| T5 | E2E 테스트 (Playwright) | 가입/등록/리뷰 핵심 흐름 |
| T6 | 시드 데이터 sql 의 office 좌표 보정 | 시드 마이그레이션 4 의 임시 좌표 → 실제값 |

---

## 진행 규칙

- 작업 들어가는 항목은 **PR + commit 메시지에 PLAN.md 의 # 번호 포함** (예: `feat: P3 bounds fit`)
- 완료 시 SPEC.md 의 D 항목으로 승격하며 PLAN 에서 제거 (또는 ✅ 마킹)
- 새 idea 떠오르면 위 카테고리 중 적절한 곳에 추가
