-- D78: Pull Request — 일반 사용자가 식당 중복 병합을 제안하면 admin 이 검토/실행.
-- 직접 merge 는 admin 만 (D77). 사용자는 PR 만 열 수 있음.

create table pull_requests (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references restaurants(id) on delete cascade,
  target_id uuid not null references restaurants(id) on delete cascade,
  opened_by uuid not null references users(id) on delete cascade,
  reason text,
  status text not null check (status in ('open', 'merged', 'closed')) default 'open',
  reviewed_by uuid references users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_id <> target_id)
);

create index idx_pull_requests_status_created on pull_requests(status, created_at desc);
create index idx_pull_requests_opened_by on pull_requests(opened_by);

alter table pull_requests enable row level security;

-- SELECT: 본인 PR + admin 은 전체
create policy "pr: read self or admin" on pull_requests
  for select to authenticated
  using (
    opened_by = auth.uid()
    or exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- INSERT: 본인이 opened_by 일 때만, status='open'
create policy "pr: insert self open" on pull_requests
  for insert to authenticated
  with check (opened_by = auth.uid() and status = 'open');

-- UPDATE: admin 만 (status / reviewed_by / reviewed_at 변경)
create policy "pr: update admin" on pull_requests
  for update to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));

grant select, insert on pull_requests to authenticated;
grant update on pull_requests to authenticated;

-- notifications type 확장
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new',
    'report_comment', 'badge_earned', 'region_champion', 'mention',
    'pull_request_new', 'pull_request_resolved'
  ));

-- 트리거: PR 열림 → admin 들에게 'pull_request_new' 노티
create or replace function notify_admins_on_pr_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_opener_name text;
  v_source_name text;
  v_target_name text;
begin
  if new.status <> 'open' then
    return new;
  end if;

  select name into v_opener_name from users where id = new.opened_by;
  select name into v_source_name from restaurants where id = new.source_id;
  select name into v_target_name from restaurants where id = new.target_id;

  for v_admin_id in select id from users where role = 'admin' loop
    insert into notifications (user_id, type, payload)
    values (
      v_admin_id,
      'pull_request_new',
      jsonb_build_object(
        'pr_id', new.id,
        'opener_name', v_opener_name,
        'source_name', v_source_name,
        'target_name', v_target_name,
        'reason', new.reason
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_pr_new on pull_requests;
create trigger trg_pr_new
after insert on pull_requests
for each row execute function notify_admins_on_pr_new();

-- 트리거: PR 처리 (merged/closed) → 작성자에게 'pull_request_resolved' 노티
create or replace function notify_opener_on_pr_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_name text;
  v_target_name text;
begin
  if old.status = new.status then
    return new;
  end if;
  if new.status not in ('merged', 'closed') then
    return new;
  end if;

  -- source 는 merged 케이스에선 이미 삭제됐을 수 있어서 PR 의 payload 에 박아두는게 정석.
  -- 일단 best-effort 로 lookup.
  select name into v_source_name from restaurants where id = new.source_id;
  select name into v_target_name from restaurants where id = new.target_id;

  insert into notifications (user_id, type, payload)
  values (
    new.opened_by,
    'pull_request_resolved',
    jsonb_build_object(
      'pr_id', new.id,
      'status', new.status,
      'source_name', coalesce(v_source_name, '(삭제됨)'),
      'target_name', coalesce(v_target_name, '?')
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_pr_resolved on pull_requests;
create trigger trg_pr_resolved
after update on pull_requests
for each row execute function notify_opener_on_pr_resolved();
