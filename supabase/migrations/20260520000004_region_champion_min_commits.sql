-- D71 보강: 대장 최소 commit 컷 (10개 이상)
-- 1, 2 commit 으로 대장 되는 게 너무 가벼움 → 적어도 한 자릿수 진입은 해야 의미있는 왕관.

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

  -- 후보: 해당 office 의 활성 commit 수, admin 제외, **최소 10개 이상**
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
   having count(*) >= 10
   order by cnt desc,
            max(rv.created_at) asc
   limit 1;

  if v_new_user is null then
    -- 컷 충족하는 후보 없으면 기존 왕관 제거
    delete from region_champions where office_id = p_office;
    return;
  end if;

  select user_id into v_old_user from region_champions where office_id = p_office;

  if v_old_user is null then
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
  else
    update region_champions
       set commit_count = v_new_count
     where office_id = p_office;
  end if;
end;
$$;

-- Re-backfill — 기존에 10 미만으로 잡힌 왕관들 정리
do $$
declare o_id uuid;
begin
  for o_id in select id from offices loop
    perform recompute_region_champion(o_id);
  end loop;
end $$;
