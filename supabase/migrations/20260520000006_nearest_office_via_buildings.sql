-- D72 보강: nearest_office_id 가 office.default_lat/lng (placeholder 위험) 대신
-- office_buildings 평균 좌표를 쓰도록. 빌딩 없는 office 만 default_lat/lng fallback.
-- D49 admin 페이지에서 office 만들 때 default_lat/lng 가 서울 시청 placeholder 였던 게
-- D72 backfill 에서 모든 도심 식당을 그 placeholder office 로 빨아들이는 사고를 막음.

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
  )
  select office_id
    from centroids
   order by (
     (cx - p_lat) * (cx - p_lat) * 1.26 * 1.26
     + (cy - p_lng) * (cy - p_lng)
   ) asc
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
