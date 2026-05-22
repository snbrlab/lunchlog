-- D70: 작성자 뱃지 시스템 (sticky achievements)
-- - user_badges: 받은 뱃지 (한 번 받으면 영구 보존, 기준 미달돼도 안 사라짐)
-- - users.primary_badge_code: 사용자가 /log 등에서 노출할 대표 뱃지 (선택)
-- - award_badges_for(uid): 모든 코드 자격 검사 후 미보유 분만 insert + 노티
-- - 리뷰 insert/update(revert flip) 시 트리거로 자동 호출

-- 1) user_badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  code text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, code)
);

create index if not exists idx_user_badges_user_awarded
  on user_badges(user_id, awarded_at desc);

alter table user_badges enable row level security;

-- 누구나 read (다른 사용자 프로필 뱃지 보기)
drop policy if exists "user_badges: read" on user_badges;
create policy "user_badges: read"
  on user_badges for select to authenticated using (true);

-- INSERT 정책 없음 — security definer 함수만 insert

-- 2) users.primary_badge_code (선택 — 대표 뱃지, /log 행에 노출)
alter table users add column if not exists primary_badge_code text;

-- 컬럼 단위 GRANT (D50 패턴: users SELECT 가 컬럼별로 막혀있어서 추가 컬럼은 명시 grant 필요)
grant select (primary_badge_code) on users to authenticated;

-- 3) notifications type 확장: badge_earned
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new',
    'report_comment', 'badge_earned'
  ));

-- ---------------------------------------------------------------
-- 4) award_badges_for(uid)
-- ---------------------------------------------------------------
create or replace function award_badges_for(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_streak int;
  v_pioneer int;
  v_distinct_groups int;
  v_total int;
  v_lunch int;
  v_dinner int;
  v_code text;
  v_existing int;
  v_cuisine_group text;
  v_cuisine_commits int;
begin
  -- 활성 commit 수
  select count(*) into v_count
    from reviews where author_id = p_user and reverted = false;

  -- KST 잔디 streak — 오늘부터 거꾸로 연속 일자
  with days as (
    select distinct (created_at at time zone 'Asia/Seoul')::date as d
      from reviews
     where author_id = p_user and reverted = false
  ),
  consec as (
    select d,
           row_number() over (order by d desc) as rn,
           (now() at time zone 'Asia/Seoul')::date - d as gap
      from days
  )
  select count(*) into v_streak from consec where gap = rn - 1;

  -- 개척: 본인이 commit 한 식당 중, 본인이 유일한 author 인 곳
  select count(*) into v_pioneer
    from (
      select restaurant_id
        from reviews
       where author_id = p_user and reverted = false
       group by restaurant_id
    ) mine
   where 1 = (
     select count(distinct r2.author_id)
       from reviews r2
      where r2.restaurant_id = mine.restaurant_id and r2.reverted = false
   );

  -- 다양성: 본인 commit 이 닿은 cuisine 그룹 수 (distinct)
  -- 한 식당의 cuisine_types[] → cuisine_items.group_label 로 매핑
  select count(distinct ci.group_label) into v_distinct_groups
    from reviews rv
    join restaurants rs on rs.id = rv.restaurant_id
    join unnest(rs.cuisine_types) as ct(value) on true
    join cuisine_items ci on ci.value = ct.value
   where rv.author_id = p_user and rv.reverted = false;

  -- 시간대 비중 (meal_time 기반)
  select
    sum(case when meal_time = 'lunch' then 1 else 0 end),
    sum(case when meal_time = 'dinner' then 1 else 0 end),
    count(*)
    into v_lunch, v_dinner, v_total
    from reviews where author_id = p_user and reverted = false;

  -- 정량 axis 뱃지 자격 검사
  for v_code in
    select code from (values
      ('commits_1',   v_count >= 1),
      ('commits_10',  v_count >= 10),
      ('commits_50',  v_count >= 50),
      ('commits_100', v_count >= 100),
      ('commits_500', v_count >= 500),
      ('streak_3',    v_streak >= 3),
      ('streak_7',    v_streak >= 7),
      ('streak_30',   v_streak >= 30),
      ('streak_100',  v_streak >= 100),
      ('pioneer_3',   v_pioneer >= 3),
      ('pioneer_10',  v_pioneer >= 10),
      ('pioneer_50',  v_pioneer >= 50),
      ('cuisines_5',  v_distinct_groups >= 5),
      ('cuisines_10', v_distinct_groups >= 10),
      ('cuisines_13', v_distinct_groups >= 13),
      ('lunch_60',    v_total >= 20 and (v_lunch::numeric / v_total) >= 0.6),
      ('dinner_60',   v_total >= 20 and (v_dinner::numeric / v_total) >= 0.6)
    ) as t(code, eligible) where eligible
  loop
    select count(*) into v_existing from user_badges
     where user_id = p_user and code = v_code;
    if v_existing = 0 then
      insert into user_badges (user_id, code) values (p_user, v_code);
      insert into notifications (user_id, type, payload)
      values (p_user, 'badge_earned', jsonb_build_object('code', v_code));
    end if;
  end loop;

  -- cuisine 특화: 각 그룹별 commit 수 ≥ 20
  for v_cuisine_group, v_cuisine_commits in
    select ci.group_label, count(distinct rv.id)
      from reviews rv
      join restaurants rs on rs.id = rv.restaurant_id
      join unnest(rs.cuisine_types) as ct(value) on true
      join cuisine_items ci on ci.value = ct.value
     where rv.author_id = p_user and rv.reverted = false
     group by ci.group_label
  loop
    if v_cuisine_commits >= 20 then
      v_code := 'cuisine_' || v_cuisine_group;
      select count(*) into v_existing from user_badges
       where user_id = p_user and code = v_code;
      if v_existing = 0 then
        insert into user_badges (user_id, code) values (p_user, v_code);
        insert into notifications (user_id, type, payload)
        values (p_user, 'badge_earned', jsonb_build_object('code', v_code));
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- 5) 트리거: 리뷰 insert / revert flip 시 작성자 재평가
-- ---------------------------------------------------------------
create or replace function trg_award_on_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform award_badges_for(new.author_id);
  elsif tg_op = 'UPDATE' then
    if (old.reverted is distinct from new.reverted) then
      perform award_badges_for(new.author_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_review_award_badges on reviews;
create trigger trg_review_award_badges
after insert or update on reviews
for each row execute function trg_award_on_review_change();

-- ---------------------------------------------------------------
-- 6) Backfill — 기존 사용자 모두에 대해 award
-- ---------------------------------------------------------------
do $$
declare u_id uuid;
begin
  for u_id in select id from users loop
    perform award_badges_for(u_id);
  end loop;
end $$;
