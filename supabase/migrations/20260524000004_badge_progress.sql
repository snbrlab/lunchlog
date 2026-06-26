-- D80: badge_progress(uid) — 모든 axis 의 현재 진행도 한 번에 JSONB 로 반환.
-- 뱃지 도감 툴팁에 "X 남았어요" 표시용. award_badges_for 의 조회 로직 재사용.

create or replace function badge_progress(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_commits int;
  v_streak int;
  v_pioneer int;
  v_distinct_groups int;
  v_total int;
  v_lunch int;
  v_dinner int;
  v_cuisine jsonb;
begin
  -- 전체 활성 commit
  select count(*) into v_commits
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

  -- pioneer: 본인 commit 한 식당 중 본인이 유일한 author 인 곳
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

  -- 다양성: distinct cuisine 그룹 수
  select count(distinct ci.group_label) into v_distinct_groups
    from reviews rv
    join restaurants rs on rs.id = rv.restaurant_id
    join unnest(rs.cuisine_types) as ct(value) on true
    join cuisine_items ci on ci.value = ct.value
   where rv.author_id = p_user and rv.reverted = false;

  -- meal_time
  select
    sum(case when meal_time = 'lunch' then 1 else 0 end),
    sum(case when meal_time = 'dinner' then 1 else 0 end),
    count(*)
    into v_lunch, v_dinner, v_total
    from reviews where author_id = p_user and reverted = false;

  -- cuisine 그룹별 commit 수
  select coalesce(jsonb_object_agg(group_label, c), '{}'::jsonb)
    into v_cuisine
    from (
      select ci.group_label, count(distinct rv.id) as c
        from reviews rv
        join restaurants rs on rs.id = rv.restaurant_id
        join unnest(rs.cuisine_types) as ct(value) on true
        join cuisine_items ci on ci.value = ct.value
       where rv.author_id = p_user and rv.reverted = false
       group by ci.group_label
    ) g;

  return jsonb_build_object(
    'commits', coalesce(v_commits, 0),
    'streak', coalesce(v_streak, 0),
    'pioneer', coalesce(v_pioneer, 0),
    'cuisines', coalesce(v_distinct_groups, 0),
    'lunch', coalesce(v_lunch, 0),
    'dinner', coalesce(v_dinner, 0),
    'total', coalesce(v_total, 0),
    'cuisine_per_group', v_cuisine
  );
end;
$$;

grant execute on function badge_progress(uuid) to authenticated;
