-- D72 사후 보정: restaurants.office_id 재매핑.
-- 식당 생성 server action 이 옛 JS 로직(15km cap 없음)을 쓰고 있어서, migration 7
-- 의 한방 UPDATE 이후 등록된 식당들이 강릉/동해/분당 좌표인데도 가장 가까운 서초로
-- 박혀버린 버그. server action 을 RPC 호출로 교체한 뒤 기존 데이터도 한 번 더
-- 재매핑하고 region_champions 도 갱신.

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

-- RPC 호출 (PostgREST) 용 명시적 grant — Supabase 의 authenticated 가 호출.
grant execute on function nearest_office_id(double precision, double precision) to authenticated;
