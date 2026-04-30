-- cuisine_type (단일) → cuisine_types (배열) 로 전환
-- 한 식당이 여러 cuisine 그룹에 속할 수 있게 (예: 한일퓨전, 한식+분식 등).
-- 안전을 위해 기존 cuisine_type 컬럼은 일단 보존 (rollback backup). 코드는 cuisine_types 만 사용.

alter table restaurants
  add column cuisine_types text[] not null default '{}';

-- 백필: 기존 단일값을 배열의 첫 원소로
update restaurants
  set cuisine_types = ARRAY[cuisine_type]
  where cuisine_type is not null;

-- 새로 들어오는 row 는 명시적으로 채우게끔 default 제거
alter table restaurants alter column cuisine_types drop default;

-- gin 인덱스: 배열 contains/overlaps 검색용
create index idx_restaurants_cuisines on restaurants using gin(cuisine_types);

-- 기존 단일 컬럼 인덱스는 더 이상 안 쓰니 제거
drop index if exists idx_restaurants_cuisine;
