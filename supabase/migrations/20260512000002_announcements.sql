-- D59: admin 작성 공지 배너
-- 헤더 아래 sticky 한 줄 배너. 여러 개 active 가능. 사용자별 dismiss 는 localStorage 로.

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 200),
  active boolean not null default true,
  created_at timestamptz default now(),
  created_by uuid references users(id) on delete set null
);

create index if not exists idx_announcements_active_created
  on announcements (active, created_at desc);

alter table announcements enable row level security;

drop policy if exists "announcements: read for authenticated" on announcements;
create policy "announcements: read for authenticated"
  on announcements for select
  to authenticated
  using (true);

drop policy if exists "announcements: admin all" on announcements;
create policy "announcements: admin all"
  on announcements for all
  to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));
