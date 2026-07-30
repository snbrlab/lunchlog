-- 식당 이슈 대상이 아직 lunchlog 에 등록 안 된 곳일 때 (지나가다 본 집 등) —
-- 카카오맵 링크 + 이름으로 지정. restaurant_id 는 null, external_* 에 저장.
alter table issues add column if not exists external_name text;
alter table issues add column if not exists external_url text;

comment on column issues.external_name is '미등록 식당 이슈의 식당 이름 (restaurant_id 없을 때)';
comment on column issues.external_url is '미등록 식당 이슈의 카카오맵 링크 (kakao 도메인만)';
