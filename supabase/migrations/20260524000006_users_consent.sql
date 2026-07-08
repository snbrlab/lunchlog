-- 가입 시 동의 이력 (PIPA). 이용약관 + 개인정보 수집·이용에 동의한 시각.
-- 둘 다 가입 폼에서 동시 동의하므로 단일 타임스탬프로 기록.
-- NULL = 이 기능 이전 가입자(동의 이력 없음) — 필요 시 재동의 프롬프트로 채움.
alter table users add column if not exists agreed_at timestamptz;

comment on column users.agreed_at is '이용약관·개인정보 처리방침 동의 시각 (가입 시)';
