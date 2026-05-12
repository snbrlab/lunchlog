// D60: 릴리즈 노트 — 코드와 함께 버전 관리.
// 사용자 시점에서 한 줄로 요약. 너무 디테일하지 않게.
// 새 항목은 배열 맨 앞에 추가 (latest first). 날짜는 KST 실제 커밋일.

export interface ReleaseItem {
  version: string;
  hash: string;
  date: string; // YYYY-MM-DD (KST)
  title: string;
  bullets: string[];
}

export const RELEASES: ReleaseItem[] = [
  {
    version: 'D59',
    hash: 'c925248',
    date: '2026-05-12',
    title: '공지 배너',
    bullets: ['관리자가 헤더 아래에 짧은 공지를 띄울 수 있어요'],
  },
  {
    version: 'D58',
    hash: 'baa50f8',
    date: '2026-05-12',
    title: '관리자 사용자 검색',
    bullets: ['/admin/users 에서 이메일/이름 검색 + 도메인 필터'],
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
    title: '사용자 삭제 / 닉네임 중복 방지',
    bullets: [
      '관리자가 사용자를 삭제할 수 있어요 (작성한 글은 보존)',
      '같은 닉네임 중복 가입 방지',
    ],
  },
  {
    version: 'D52',
    hash: 'f77cf8b',
    date: '2026-05-08',
    title: '활동 잔디',
    bullets: ['마이페이지와 프로필에 1년 활동 잔디 (GitHub 스타일)'],
  },
  {
    version: 'D51',
    hash: '6474edf',
    date: '2026-05-07',
    title: '관리자 임의 사용자 추가',
    bullets: ['사내 도메인이 아닌 이메일도 관리자가 직접 계정 생성'],
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
];
