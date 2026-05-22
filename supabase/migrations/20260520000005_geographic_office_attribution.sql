-- D72: restaurants.office_id 의미를 "지리적 가장 가까운 office" 로 변경.
-- 이전엔 "처음 등록한 사람의 office_id" 였음 (D43) — 평택 사람이 마곡 식당 등록하면
-- 마곡 식당이 평택으로 잡혀서 D71 대장 계산이 부정확. 좌표 기반으로 재매핑.

-- 1) 가장 가까운 office id 를 반환하는 헬퍼 함수 (offices.default_lat/lng 기준)
--    Haversine 대신 빠른 평면 근사 — office 간 거리 비교만 하면 되니까 충분.
create or replace function nearest_office_id(p_lat double precision, p_lng double precision)
returns uuid
language sql
stable
as $$
  select id
    from offices
   order by (
     -- 평면 거리^2 (실제 거리 계산 불필요, 순서만 맞으면 됨).
     -- 위도 1° ≈ 111km, 경도 1° at lat≈37 ≈ 88km. 비율 보정 1.26
     (default_lat - p_lat) * (default_lat - p_lat) * 1.26 * 1.26
     + (default_lng - p_lng) * (default_lng - p_lng)
   ) asc
   limit 1;
$$;

-- 2) 기존 restaurants 의 office_id 를 좌표 기반으로 재매핑
update restaurants
   set office_id = nearest_office_id(latitude, longitude)
 where latitude is not null and longitude is not null;

-- 3) 모든 office 의 region_champions 재계산 (매핑 바뀌었으니까)
do $$
declare o_id uuid;
begin
  for o_id in select id from offices loop
    perform recompute_region_champion(o_id);
  end loop;
end $$;
