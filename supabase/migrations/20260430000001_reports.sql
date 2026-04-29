-- 사용자 제보 (버그/기능제안/식당오류/기타)
-- mailto 대신 인앱 폼 + DB 저장. admin 이 /admin/reports 에서 처리.

create table reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id) on delete cascade,
  category text not null check (category in ('bug', 'feature', 'restaurant', 'other')),
  message text not null check (char_length(message) between 1 and 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  admin_note text,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

create index idx_reports_status on reports(status);
create index idx_reports_created on reports(created_at desc);

alter table reports enable row level security;

-- insert: 인증 사용자, author_id = 본인
create policy "reports: insert self"
  on reports for insert to authenticated
  with check (author_id = auth.uid());

-- select: 본인 + admin
create policy "reports: select self or admin"
  on reports for select to authenticated
  using (author_id = auth.uid() or is_admin());

-- update: admin only (status, admin_note 등)
create policy "reports: update admin only"
  on reports for update to authenticated
  using (is_admin())
  with check (is_admin());

-- delete: admin only
create policy "reports: delete admin only"
  on reports for delete to authenticated
  using (is_admin());
