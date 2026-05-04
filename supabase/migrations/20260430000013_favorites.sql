-- D44: 찜 (favorites) — 나중에 가볼 곳 모음
-- (user_id, restaurant_id) PK 로 중복 방지. RLS: 본인 row 만 read/insert/delete.

create table favorites (
  user_id uuid not null references users(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);

create index idx_favorites_user on favorites(user_id, created_at desc);

alter table favorites enable row level security;

create policy "favorites: read self"
  on favorites for select to authenticated
  using (user_id = auth.uid());

create policy "favorites: insert self"
  on favorites for insert to authenticated
  with check (user_id = auth.uid());

create policy "favorites: delete self"
  on favorites for delete to authenticated
  using (user_id = auth.uid());
