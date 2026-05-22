-- D73: 빌딩 삭제 지원.
-- users.building_id 가 office_buildings 를 참조하는데 기본 FK 는 RESTRICT 라
-- 사용자 한 명이라도 그 건물 쓰면 삭제 불가. ON DELETE SET NULL 로 변경 —
-- 사용자는 건물 정보만 비워지고 행은 유지됨. 다음 /me 방문 시 다시 고르도록 유도.

alter table users drop constraint if exists users_building_id_fkey;
alter table users
  add constraint users_building_id_fkey
  foreign key (building_id) references office_buildings(id) on delete set null;
