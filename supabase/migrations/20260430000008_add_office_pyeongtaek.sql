-- 근무지 추가: 평택 (LG디지털파크)
-- LG디지털파크: 경기도 평택시 진위면 LG로 222

insert into offices (id, name, slug, default_lat, default_lng) values
  ('00000000-0000-0000-0000-000000000003', '평택', 'pyeongtaek', 37.0625, 127.0586);

insert into office_buildings (office_id, name, latitude, longitude, display_order) values
  ('00000000-0000-0000-0000-000000000003', 'LG디지털파크', 37.0625, 127.0586, 1);
