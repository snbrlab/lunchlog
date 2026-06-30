// D60: 릴리즈 노트 — 사용자 시점에서 한 줄 요약.
// admin 전용 변경은 제외. 새 항목은 배열 맨 앞에 추가 (latest first).
// 날짜는 KST 실제 커밋일.

export interface ReleaseItem {
  version: string;
  hash: string;
  date: string; // YYYY-MM-DD (KST)
  title: string;
  bullets: string[];
}

export const RELEASES: ReleaseItem[] = [
  {
    version: 'D82',
    hash: 'pending',
    date: '2026-06-06',
    title: '🖥️ 개발자 모드 — 가상 터미널',
    bullets: [
      '헤더 🖥️ 아이콘 → /dev — 사옥/점심|저녁/cuisine/식당 트리를 Unix 처럼 탐색',
      'ls / cd / cat / pwd — README.md, INFO, MENU, .kakao 열람',
      'git log [path] — 식당/지역 전체 commit time-sorted',
      'git show <hash> — 단일 commit 상세',
      'git contributors / git stats — 작성자 leaderboard + 전체 통계',
      'grep <pat> [path] / find <pattern> — commit 메시지 + 파일 + 식당 이름 검색',
      'whoami / date / history / clear (Ctrl+L)',
      'Easter eggs: sudo, rm -rf, vim, apt, cowsay 🐮 등',
      '색깔: 디렉토리 sky / hash amber / 작성자 cyan / revert 취소선',
    ],
  },
  {
    version: 'D78',
    hash: '9c8ef76',
    date: '2026-06-05',
    title: '🔀 Pull Request — 중복 병합 + 정보 수정 제안',
    bullets: [
      '식당 상세에 [🔀 PR] 버튼 — git PR 처럼 동료들과 식당 정보 정리',
      '🔀 중복 병합 — "이 식당과 ○○ 가 같은 곳이에요" 제안 → admin 검토 후 병합',
      '✏️ 정보 수정 — 이름 / 가격대 / cuisine / 주소 / 술 가능 여부 변경 제안',
      'PR 활동이 /log 에 함께 표시 — git activity feed 느낌 (열림 / 적용 / 거부)',
      'PR 처리되면 작성자에게 알림 (✅ 적용됐어요 / 🚫 거부됐어요)',
    ],
  },
  {
    version: 'D79',
    hash: 'e569ae3',
    date: '2026-06-03',
    title: 'commit 에 이모지 reaction 🎉',
    bullets: [
      'GitHub 이슈 reaction 처럼 commit 마다 이모지로 가볍게 반응 (👍 ❤️ 😋 😲 🎉 등)',
      'reaction 누른 사람 hover 로 확인',
      '/log + /map 디테일 패널 둘 다 지원',
      '모바일은 commit tap 으로 + 버튼 활성화',
    ],
  },
  {
    version: 'D74',
    hash: 'fb886fb',
    date: '2026-06-02',
    title: '소통 강화 — @멘션 + 🔔 알림 모아보기',
    bullets: [
      '@닉네임 으로 다른 사람 멘션 — composer 에서 자동완성, 멘션받은 사람에게 알림',
      '메시지의 @닉네임 부분은 sky 색 chip 으로 시각화',
      '헤더 🔔 아이콘 — 미확인 / 읽은 알림 최근 20개 모아보기, 미확인 수 뱃지 표시',
      '"전체 읽음" 한 번에 정리',
    ],
  },
  {
    version: 'D73',
    hash: '2f22c31',
    date: '2026-06-01',
    title: '지도/Log 보강',
    bullets: [
      '지도 사이드바에 "인기순" 정렬 추가 — commit 많은 순으로 정렬',
      '/log 의 지역 필터를 작성자 근무지 → 식당 지역 기준으로 변경 (어디서 먹은 commit 인지로 분류)',
    ],
  },
  {
    version: 'D70',
    hash: 'ba48f74',
    date: '2026-05-22',
    title: '뱃지 + 지역별 대장 👑',
    bullets: [
      '30개 뱃지 (활동량 / 꾸준함 / 개척 / 다양성 / 시간대 / cuisine 특화)',
      '마이페이지 도감에서 받은 거 확인 + 대표 뱃지 선택 → /log 에 노출',
      '지역별 대장 — 그 지역 식당 commit 1위가 가져가는 👑 롤링 왕관 (빼앗기는 자리)',
      '새 뱃지 / 새 왕관 받으면 알림',
    ],
  },
  {
    version: 'D68',
    hash: '693d91e',
    date: '2026-05-20',
    title: '임시 근무지 위치 직접 지정',
    bullets: [
      '공유 오피스 등 등록 안 된 곳에서 일할 때 거리/도보 시간이 안 맞던 문제 해결',
      '마이페이지 → 프로필 편집에서 "건물 말고 다른 위치에서 근무 중이에요" 켜고 카카오 검색으로 위치 선택',
      '한 번 설정하면 어느 기기에서든 동일하게 적용돼요',
    ],
  },
  {
    version: 'D63',
    hash: '11b3d0f',
    date: '2026-05-15',
    title: '카테고리 필터 지도 연동',
    bullets: ['사이드바에서 카테고리 / 술 가능 필터 걸면 지도 핀도 같이 줄어들어요'],
  },
  {
    version: 'D59',
    hash: 'c925248',
    date: '2026-05-12',
    title: '공지 배너',
    bullets: ['헤더 아래에 공지가 한 줄로 떠요 — ✕ 누르면 다시 안 보여요'],
  },
  {
    version: 'D57',
    hash: '399a884',
    date: '2026-05-12',
    title: '같은 위치 식당 묶음',
    bullets: [
      '가까이 있는 식당끼리 자동으로 묶여서 표시',
      '클릭하면 펼쳐서 하나 골라 볼 수 있어요',
      '지도 줌에 따라 묶임 정도가 달라져요',
    ],
  },
  {
    version: 'D55',
    hash: 'd5f6eba',
    date: '2026-05-12',
    title: '속도 개선',
    bullets: ['지도 진입이 더 가벼워졌어요', '같은 식당을 다시 열 때 즉시 반응'],
  },
  {
    version: 'D53',
    hash: '8569e5e',
    date: '2026-05-08',
    title: '닉네임 중복 방지',
    bullets: ['같은 닉네임으로는 가입 / 변경이 안 돼요'],
  },
  {
    version: 'D52',
    hash: 'f77cf8b',
    date: '2026-05-08',
    title: '활동 잔디',
    bullets: ['마이페이지와 프로필에 1년 활동 잔디 (GitHub 스타일)'],
  },
  {
    version: 'D50',
    hash: '8229c35',
    date: '2026-05-07',
    title: '사용자 프로필 페이지',
    bullets: [
      '닉네임 클릭 시 그 사람의 프로필로 이동',
      '작성한 commit 과 찜한 곳을 한 화면에서 확인',
    ],
  },
  {
    version: 'D48',
    hash: '322ed93',
    date: '2026-05-07',
    title: '비밀번호 재설정',
    bullets: ['로그인 화면에서 직접 비밀번호 재설정 가능 (이메일 인증 코드)'],
  },
  {
    version: 'D47',
    hash: 'd9d35ca',
    date: '2026-05-07',
    title: 'OTP 가입',
    bullets: ['이메일 인증 코드로 가입 — 관리자 승인 없이 바로 시작'],
  },
  {
    version: 'v0',
    hash: '03de8cc',
    date: '2026-04-29',
    title: '런치로그 첫 commit 🎉',
    bullets: [
      '동료끼리 사내 맛집을 git commit 스타일로 공유하는 지도 서비스 시작',
    ],
  },
];
