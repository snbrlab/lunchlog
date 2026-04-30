-- 가입 요청 (admin 승인 가입 흐름)
-- 사용자가 /signup 에서 이메일+이름+비밀번호 입력 → auth.users 가 email_confirm=false 로 미리 생성됨
-- 동시에 signup_requests 에 row 가 쌓이고, admin 이 /admin/signups 에서 승인하면 email_confirmed_at 세팅 + users 프로필 행 생성

create table signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  -- 미승인 상태로 미리 만들어둔 auth.users.id
  auth_user_id uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references users(id) on delete set null,
  denied_reason text
);

-- 한 이메일당 동시에 하나의 pending 만 (denied/approved 후 재신청은 가능)
create unique index uniq_signup_pending_email on signup_requests(email) where status = 'pending';
create index idx_signup_status_requested on signup_requests(status, requested_at desc);

alter table signup_requests enable row level security;

-- 일반 사용자는 직접 못 본다. server action 이 service-role 키로 처리.
create policy "signup_requests: admin only read"
  on signup_requests for select to authenticated using (is_admin());

create policy "signup_requests: admin only write"
  on signup_requests for all to authenticated
  using (is_admin())
  with check (is_admin());
