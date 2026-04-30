-- 근무지 추가: 여의도 (LG트윈타워)
-- LG트윈타워: 서울 영등포구 여의대로 128

insert into offices (id, name, slug, default_lat, default_lng) values
  ('00000000-0000-0000-0000-000000000002', '여의도', 'yeouido', 37.5266, 126.9279);

insert into office_buildings (office_id, name, latitude, longitude, display_order) values
  ('00000000-0000-0000-0000-000000000002', 'LG트윈타워', 37.5266, 126.9279, 1);
