-- D72 사후 보정: nearest_office_id 의 거리 컷을 15km → 7km 로 축소.
-- 15km 면 광진구 식당이 서울역(직선 8km, 도로 14km) 으로 잡혀 직관과 어긋남.
-- 7km 직선 ≒ 9-12km 도로 = 진짜 점심 갈 만한 도보권/택시권만 사옥에 귀속.
-- 광진구/분당/판교/강릉/동해 등 사옥 없는 동네 식당은 모두 미분류로 빠짐.

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
      sqrt(
        power((cx - p_lat) * 111.0, 2)
        + power((cy - p_lng) * 88.6, 2)
      ) as km
      from centroids
  )
  select office_id
    from with_dist
   where km <= 7
   order by km asc
   limit 1;
$$;

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
