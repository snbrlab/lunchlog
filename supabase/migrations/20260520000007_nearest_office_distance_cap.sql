-- D72 보강: nearest_office_id 에 거리 컷 추가.
-- 강릉/분당 식당이 가장 가깝다는 이유로 서초로 잡혀버리는 사고 방지.
-- 15km 이내 office 가 없으면 NULL 반환 → restaurants.office_id NULL → '미매핑'.

create or replace function nearest_office_id(p_lat double precision, p_lng double precision)
returns uuid
language sql
stable
as $$
  with centroids as (
    select
      o.id as office_id,
      coalesce(avg(b.latitude),  o.default_lat) as cx,
      coalesce(avg(b.longitude), o.default_lng) as cy
    from offices o
    left join office_buildings b on b.office_id = o.id
    group by o.id, o.default_lat, o.default_lng
  ),
  with_dist as (
    select office_id,
      -- 한국 위도 평면 근사: 1° lat ≈ 111km, 1° lng ≈ 88.6km
      sqrt(
        power((cx - p_lat) * 111.0, 2)
        + power((cy - p_lng) * 88.6, 2)
      ) as km
      from centroids
  )
  select office_id
    from with_dist
   where km <= 15  -- 15km 컷. 너무 멀면 NULL (미매핑).
   order by km asc
   limit 1;
$$;

-- 재매핑 + region_champions 재계산
update restaurants
   set office_id = nearest_office_id(latitude, longitude)
 where latitude is not null and longitude is not null;

do $$
declare o_id uuid;
begin
  for o_id in select id from offices loop
    perform recompute_region_champion(o_id);
  end loop;
end $$;
