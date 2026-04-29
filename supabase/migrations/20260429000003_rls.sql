-- Phase 1: RLS 정책 (SPEC 2.6)
-- + admin 우회: 관리자는 자기 글이 아니어도 / 24h 지나도 update/delete 가능

alter table offices          enable row level security;
alter table office_buildings enable row level security;
alter table users            enable row level security;
alter table restaurants      enable row level security;
alter table reviews          enable row level security;

-- is_admin(): 호출자가 admin 인지
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'admin' from users where id = auth.uid()),
    false
  );
$$;

----------------------------------------------------------------
-- offices / office_buildings: 인증된 사용자 전원 read
----------------------------------------------------------------
create policy "offices: read for authenticated"
  on offices for select to authenticated using (true);

create policy "offices: write for admin"
  on offices for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy "office_buildings: read for authenticated"
  on office_buildings for select to authenticated using (true);

create policy "office_buildings: write for admin"
  on office_buildings for all to authenticated
  using (is_admin())
  with check (is_admin());

----------------------------------------------------------------
-- users: 본인 + 동일 인증 사용자 read, 본인만 update (role 변경은 admin)
----------------------------------------------------------------
create policy "users: read for authenticated"
  on users for select to authenticated using (true);

create policy "users: insert self only"
  on users for insert to authenticated
  with check (id = auth.uid());

-- 본인 행 update 가능. 단, role 컬럼은 admin 만 변경 가능.
-- (CHECK 단계에서 새 role 이 기존과 다르면 admin 이어야 함)
create policy "users: update self (role admin-only)"
  on users for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (
    (id = auth.uid() and role = (select role from users where id = auth.uid()))
    or is_admin()
  );

create policy "users: delete admin-only"
  on users for delete to authenticated
  using (is_admin());

----------------------------------------------------------------
-- restaurants
----------------------------------------------------------------
create policy "restaurants: read for authenticated"
  on restaurants for select to authenticated using (true);

create policy "restaurants: insert for authenticated"
  on restaurants for insert to authenticated
  with check (created_by = auth.uid());

-- 등록자 본인 또는 admin
create policy "restaurants: update by owner or admin"
  on restaurants for update to authenticated
  using (created_by = auth.uid() or is_admin())
  with check (created_by = auth.uid() or is_admin());

create policy "restaurants: delete admin-only"
  on restaurants for delete to authenticated
  using (is_admin());

----------------------------------------------------------------
-- reviews (D20: 본인 글 24h 이내만 수정/삭제. admin 은 우회)
----------------------------------------------------------------
create policy "reviews: read for authenticated"
  on reviews for select to authenticated using (true);

create policy "reviews: insert by self"
  on reviews for insert to authenticated
  with check (author_id = auth.uid());

create policy "reviews: update self within 24h or admin"
  on reviews for update to authenticated
  using (
    is_admin()
    or (author_id = auth.uid() and created_at >= now() - interval '24 hours')
  )
  with check (
    is_admin()
    or (author_id = auth.uid() and created_at >= now() - interval '24 hours')
  );

create policy "reviews: delete self within 24h or admin"
  on reviews for delete to authenticated
  using (
    is_admin()
    or (author_id = auth.uid() and created_at >= now() - interval '24 hours')
  );
