-- D41 보강: admin 에게도 노티 발송
-- 1) 새 가입 신청 (signup_requests INSERT) → 모든 admin 에게 노티
-- 2) 새 제보 (reports INSERT) → 모든 admin 에게 노티
--
-- check 제약을 두 종류 더 추가하기 위해 type column 의 check 도 갱신
-- idempotent 하게 작성 (드롭 후 재생성)

-- type check 갱신: 'signup_request_new', 'report_new' 추가
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('report_update', 'review_reply', 'signup_request_new', 'report_new'));

-- ---------------------------------------------------------------
-- 트리거 3: 새 가입 신청 → 모든 admin 에게 노티
-- ---------------------------------------------------------------
create or replace function notify_admins_on_signup_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, payload)
  select
    u.id,
    'signup_request_new',
    jsonb_build_object(
      'request_id', new.id,
      'email', new.email,
      'name', new.name
    )
  from users u
  where u.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_signup_request_admin_notify on signup_requests;
create trigger trg_signup_request_admin_notify
after insert on signup_requests
for each row execute function notify_admins_on_signup_request();

-- ---------------------------------------------------------------
-- 트리거 4: 새 제보 → 모든 admin 에게 노티
-- ---------------------------------------------------------------
create or replace function notify_admins_on_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
begin
  select name into v_author_name from users where id = new.author_id;
  insert into notifications (user_id, type, payload)
  select
    u.id,
    'report_new',
    jsonb_build_object(
      'report_id', new.id,
      'author_id', new.author_id,
      'author_name', v_author_name,
      'category', new.category,
      'message', left(new.message, 100)
    )
  from users u
  where u.role = 'admin';
  return new;
end;
$$;

drop trigger if exists trg_report_admin_notify on reports;
create trigger trg_report_admin_notify
after insert on reports
for each row execute function notify_admins_on_report();
