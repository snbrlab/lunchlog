-- 승인제 가입(signup_requests)은 OTP 셀프가입(D47)으로 대체된 죽은 경로.
-- 신청자 이메일이 signup_requests + 옛 admin 알림 payload 에 정리 없이 남아 있어 제거(개인정보 최소화).

-- 1) 옛 알림 속 이메일 사본 제거
delete from notifications where type = 'signup_request_new';

-- 2) 테이블 제거 (INSERT 트리거도 cascade 로 함께 제거됨)
drop table if exists signup_requests cascade;

-- 3) 트리거 함수 제거 (더 이상 참조 없음)
drop function if exists notify_admins_on_signup_request();
