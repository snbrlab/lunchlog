-- D77 보강: merge_restaurants 가 source 의 metadata 도 target 으로 union.
-- 이전엔 review/favorites 만 이전하고 categories/cuisine_types/menu_tags/has_alcohol 등은
-- target 거 그대로 → source 에 있던 정보 손실 (예: source 가 점심+저녁 / target 이 점심만이면
-- merge 후에도 target 은 점심만 표시).

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

  -- 0) source 의 metadata 를 target 에 union (source 삭제 전)
  update restaurants tgt
     set
       categories = (
         select array(select distinct unnest(tgt.categories || src.categories))
       ),
       cuisine_types = (
         select array(select distinct unnest(tgt.cuisine_types || src.cuisine_types))
       ),
       menu_tags = (
         select array(select distinct unnest(tgt.menu_tags || src.menu_tags))
       ),
       has_alcohol = tgt.has_alcohol or src.has_alcohol,
       recommended_min_size = least(
         coalesce(tgt.recommended_min_size, src.recommended_min_size),
         coalesce(src.recommended_min_size, tgt.recommended_min_size)
       ),
       recommended_max_size = greatest(
         coalesce(tgt.recommended_max_size, src.recommended_max_size),
         coalesce(src.recommended_max_size, tgt.recommended_max_size)
       ),
       kakao_place_url = coalesce(tgt.kakao_place_url, src.kakao_place_url)
    from restaurants src
   where tgt.id = p_target
     and src.id = p_source;

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
