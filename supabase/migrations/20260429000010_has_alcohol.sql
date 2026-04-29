-- restaurants 에 술 가능 여부 추가. 음식 종류와 직교(orthogonal) 차원.

alter table restaurants
  add column has_alcohol boolean not null default false;

-- 기존 시드 식당 매핑: cuisine_type 이 '술집' 인 곳은 자동 true.
update restaurants set has_alcohol = true where cuisine_type = '술집';
