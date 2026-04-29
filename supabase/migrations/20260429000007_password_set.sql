-- ID/PW 인증 보완: 사용자가 비번을 직접 설정했는지 추적.
-- 매직링크로만 가입한 상태에선 false. /set-password 통과 후 true.
-- proxy 가드가 false 인 사용자는 /set-password 로 강제 이동.

alter table users
  add column password_set boolean not null default false;
