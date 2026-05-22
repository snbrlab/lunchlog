-- D71: 지역별 대장 (롤링 왕관)
-- 한 office 당 1명 — 그 office 의 식당에 대한 활성 commit 수가 가장 많은 사용자.
-- admin 은 후보에서 제외. 동률은 먼저 도달한 사람 유지 (since_at 우선).
-- 새 대장이 바뀌면 신규 대장에게만 노티.

create table if not exists region_champions (
  office_id uuid primary key references offices(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  commit_count int not null default 0,
  since_at timestamptz not null default now()
);

create index if not exists idx_region_champions_user on region_champions(user_id);

alter table region_champions enable row level security;

drop policy if exists "region_champions: read" on region_champions;
create policy "region_champions: read"
  on region_champions for select to authenticated using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — security definer 함수만

-- notifications type 확장
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new',
    'report_comment', 'badge_earned', 'region_champion'
  ));

-- ---------------------------------------------------------------
-- recompute_region_champion(office_uuid)
-- 해당 office 의 새 대장 계산 → 변경됐으면 region_champions 갱신 + 노티
-- ---------------------------------------------------------------
create or replace function recompute_region_champion(p_office uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user uuid;
  v_new_count int;
  v_old_user uuid;
  v_office_name text;
begin
  select name into v_office_name from offices where id = p_office;
  if v_office_name is null then return; end if;

  -- 후보: 그 office 의 식당에 대한 활성 commit 수, admin 제외
  select rv.author_id, count(*) as cnt
    into v_new_user, v_new_count
    from reviews rv
    join restaurants rs on rs.id = rv.restaurant_id
    join users u on u.id = rv.author_id
   where rs.office_id = p_office
     and rv.reverted = false
     and rv.author_id is not null
     and u.role <> 'admin'
   group by rv.author_id
   order by cnt desc,
            -- 동률 시 먼저 그 카운트에 도달한 사람 우선:
            -- 가장 늦은 commit 시각이 빠른 사람 = 일찍 도달한 사람
            max(rv.created_at) asc
   limit 1;

  if v_new_user is null then
    -- 후보 없으면 기존 왕관 제거
    delete from region_champions where office_id = p_office;
    return;
  end if;

  select user_id into v_old_user from region_champions where office_id = p_office;

  if v_old_user is null then
    -- 첫 대장
    insert into region_champions (office_id, user_id, commit_count, since_at)
    values (p_office, v_new_user, v_new_count, now());
    insert into notifications (user_id, type, payload)
    values (v_new_user, 'region_champion',
            jsonb_build_object(
              'office_id', p_office,
              'office_name', v_office_name,
              'commit_count', v_new_count
            ));
  elsif v_old_user <> v_new_user then
    -- 왕관 이동
    update region_champions
       set user_id = v_new_user, commit_count = v_new_count, since_at = now()
     where office_id = p_office;
    insert into notifications (user_id, type, payload)
    values (v_new_user, 'region_champion',
            jsonb_build_object(
              'office_id', p_office,
              'office_name', v_office_name,
              'commit_count', v_new_count
            ));
    -- 빼앗긴 사람에겐 노티 안 보냄
  else
    -- 같은 사람이 유지 — count 만 업데이트 (since_at 보존)
    update region_champions
       set commit_count = v_new_count
     where office_id = p_office;
  end if;
end;
$$;

-- ---------------------------------------------------------------
-- 트리거: 리뷰 insert / UPDATE(revert flip) → 해당 식당의 office 재계산
-- ---------------------------------------------------------------
create or replace function trg_recompute_champion_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_office uuid;
begin
  if tg_op = 'INSERT' then
    select office_id into v_office from restaurants where id = new.restaurant_id;
    if v_office is not null then
      perform recompute_region_champion(v_office);
    end if;
  elsif tg_op = 'UPDATE' then
    if (old.reverted is distinct from new.reverted) then
      select office_id into v_office from restaurants where id = new.restaurant_id;
      if v_office is not null then
        perform recompute_region_champion(v_office);
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    select office_id into v_office from restaurants where id = old.restaurant_id;
    if v_office is not null then
      perform recompute_region_champion(v_office);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_champion on reviews;
create trigger trg_review_champion
after insert or update or delete on reviews
for each row execute function trg_recompute_champion_on_review();

-- ---------------------------------------------------------------
-- Backfill — 기존 office 별 1회 계산
-- ---------------------------------------------------------------
do $$
declare o_id uuid;
begin
  for o_id in select id from offices loop
    perform recompute_region_champion(o_id);
  end loop;
end $$;
