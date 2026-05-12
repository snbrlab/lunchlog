// D60: 릴리즈 노트 — 코드와 함께 버전 관리. 새 기능/수정 묶음마다 한 줄 추가.
// 해시는 실제 git commit (앞 7자리). 사람이 큐레이션해서 노출하고 싶은 것만 정리.
//
// 새 항목은 배열 맨 앞에 추가 (latest first).

export interface ReleaseItem {
  version: string;        // 의미 부여 안 함 — D 번호 또는 v0.x.y
  hash: string;           // 실제 git short hash
  date: string;           // YYYY-MM-DD (KST)
  title: string;
  bullets: string[];
}

export const RELEASES: ReleaseItem[] = [
  {
    version: 'D59',
    hash: 'c925248',
    date: '2026-05-12',
    title: 'admin 공지 배너',
    bullets: [
      '헤더 아래 monospace 한 줄 배너 — > prefix, ✕ 로 닫기',
      'admin 이 직접 작성, localStorage 에 닫은 공지 기억',
      '/admin/announcements 에서 작성·내리기·삭제',
    ],
  },
  {
    version: 'D58',
    hash: 'baa50f8',
    date: '2026-05-12',
    title: '/admin/users 이메일/도메인 필터',
    bullets: [
      '이메일/이름 substring 검색',
      '도메인 chip 자동 집계 (@lge.com / @gmail.com 등)',
      '사내 사용자 / 외부 손님 빠르게 구분',
    ],
  },
  {
    version: 'D57',
    hash: '399a884',
    date: '2026-05-12',
    title: '같은 좌표 식당 클러스터 마커',
    bullets: [
      '가까운 식당끼리 자동으로 +N 배지로 묶음',
      '줌 인하면 풀려서 개별 핀, 줌 아웃하면 모임',
      '클러스터 핀 클릭 → popover 에서 식당 선택',
    ],
  },
  {
    version: 'D55',
    hash: 'd5f6eba',
    date: '2026-05-12',
    title: '/map 체감 속도 개선',
    bullets: [
      '식당 목록 payload 슬림화 + 디테일 패널에서만 단건 fetch',
      '같은 식당 두 번 열면 ReviewLog 메모리 캐시로 즉시 반응',
    ],
  },
  {
    version: 'D54',
    hash: 'e7eac3f',
    date: '2026-05-12',
    title: '/map 식당 캐시 + perf 인덱스',
    bullets: [
      '식당 목록을 1시간 캐시 (식당/리뷰 변경 시 즉시 무효화)',
      'reviews / restaurants 인덱스 보강 — /log + 잔디 가속',
    ],
  },
  {
    version: 'D53',
    hash: '8569e5e',
    date: '2026-05-12',
    title: '사용자 삭제 + 닉네임 중복 방지',
    bullets: [
      '/admin/users 에 사용자 삭제 (commit / 등록 식당은 보존, 작성자는 익명 처리)',
      '닉네임 case-insensitive unique — 가입/프로필 편집/admin 추가 모두 검증',
    ],
  },
  {
    version: 'D52',
    hash: 'c2447c4',
    date: '2026-05-12',
    title: '마이페이지 활동 잔디',
    bullets: [
      'GitHub 잔디 스타일 1년 활동 히트맵 — /me 와 /u/[id]',
      '/me 첫 화면을 잔디 → 찜 → 내 commit 순으로 재배치',
    ],
  },
];
