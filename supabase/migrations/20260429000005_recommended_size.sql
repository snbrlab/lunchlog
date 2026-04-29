-- restaurants 에 추천 인원 범위 추가 (nullable, 둘 다 같이 set or 둘 다 null)

alter table restaurants
  add column recommended_min_size int,
  add column recommended_max_size int;

alter table restaurants
  add constraint restaurants_recommended_size_check
  check (
    (recommended_min_size is null and recommended_max_size is null)
    or (
      recommended_min_size is not null
      and recommended_max_size is not null
      and recommended_min_size between 1 and 99
      and recommended_max_size between 1 and 99
      and recommended_min_size <= recommended_max_size
    )
  );
