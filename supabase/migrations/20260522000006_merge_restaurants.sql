-- D77: 식당 병합. race condition 등으로 중복 등록된 식당을 하나로 합침.
-- admin 전용 기능 — server action 에서 권한 체크 후 RPC 호출.
--
-- 동작:
-- 1) 리뷰: restaurant_id = source → target 로 이전
-- 2) 찜: 이미 target 찜한 사람은 skip 후 source 찜 삭제, 나머지는 target 으로 이전
-- 3) source 식당 삭제
-- 4) target 의 commit_count / last_commit_at 재계산
-- 5) 양쪽 office 의 region_champions 재계산

create or replace function merge_restaurants(p_source uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_office uuid;
  v_target_office uuid;
begin
  if p_source = p_target then
    raise exception 'source 와 target 이 같음';
  end if;
  if not exists (select 1 from restaurants where id = p_source) then
    raise exception 'source 식당이 존재하지 않음';
  end if;
  if not exists (select 1 from restaurants where id = p_target) then
    raise exception 'target 식당이 존재하지 않음';
  end if;

  select office_id into v_source_office from restaurants where id = p_source;
  select office_id into v_target_office from restaurants where id = p_target;

  -- 1) 리뷰 이전
  update reviews set restaurant_id = p_target where restaurant_id = p_source;

  -- 2) 찜 이전 — 이미 target 찜한 사람의 source 찜은 삭제 (PK conflict 방지)
  delete from favorites
   where restaurant_id = p_source
     and user_id in (select user_id from favorites where restaurant_id = p_target);
  update favorites set restaurant_id = p_target where restaurant_id = p_source;

  -- 3) source 식당 삭제
  delete from restaurants where id = p_source;

  -- 4) target commit_count / last_commit_at 재계산
  update restaurants r
     set commit_count = coalesce((
           select count(*)::int from reviews
            where restaurant_id = r.id and not reverted and parent_review_id is null
         ), 0),
         last_commit_at = (
           select max(created_at) from reviews
            where restaurant_id = r.id and not reverted and parent_review_id is null
         )
   where id = p_target;

  -- 5) region_champions 재계산 (양쪽 office)
  if v_source_office is not null then
    perform recompute_region_champion(v_source_office);
  end if;
  if v_target_office is not null and v_target_office is distinct from v_source_office then
    perform recompute_region_champion(v_target_office);
  end if;
end;
$$;

grant execute on function merge_restaurants(uuid, uuid) to authenticated;
