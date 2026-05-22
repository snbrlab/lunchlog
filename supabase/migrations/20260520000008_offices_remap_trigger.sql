-- D72 보강: office / office_buildings 변경 시 식당 office_id 자동 재매핑.
-- 신규 office 추가 / 빌딩 좌표 갱신 후 admin 이 따로 작업 안 해도
-- 모든 식당이 자동으로 가까운 office 로 다시 잡힘 + region_champions 재계산.
-- statement-level 트리거라 한 트랜잭션에 여러 행 변경돼도 한 번만 도는 게 일반적.

create or replace function remap_all_restaurants_office()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare o_id uuid;
begin
  update restaurants
     set office_id = nearest_office_id(latitude, longitude)
   where latitude is not null and longitude is not null;

  for o_id in select id from offices loop
    perform recompute_region_champion(o_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_offices_remap on offices;
create trigger trg_offices_remap
after insert or update or delete on offices
for each statement execute function remap_all_restaurants_office();

drop trigger if exists trg_office_buildings_remap on office_buildings;
create trigger trg_office_buildings_remap
after insert or update or delete on office_buildings
for each statement execute function remap_all_restaurants_office();
