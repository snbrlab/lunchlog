-- D68: 사용자 임시 근무지 좌표 직접 지정
-- 공유 오피스 등 등록된 건물에 없는 곳에서 근무하는 사용자가
-- 마이페이지에서 직접 좌표를 박을 수 있도록 컬럼 추가.
-- origin 우선순위: custom_lat/lng > building > fallback.

alter table users
  add column if not exists custom_lat double precision,
  add column if not exists custom_lng double precision;

-- 둘 다 set 이거나 둘 다 null 이어야 일관 (한쪽만 채워지면 origin 계산이 깨짐)
alter table users
  drop constraint if exists users_custom_origin_both;
alter table users
  add constraint users_custom_origin_both
  check (
    (custom_lat is null and custom_lng is null)
    or (custom_lat is not null and custom_lng is not null)
  );
