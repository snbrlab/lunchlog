-- D71 보강: 활성 리뷰 (reverted=false) 대상 부분 인덱스
-- D70 award_badges_for, D71 recompute_region_champion 둘 다 활성 리뷰만 집계.
-- 기존 idx_reviews_author_created 는 reverted 무관이라 일부 가지치기 안 됨.

create index if not exists idx_reviews_active_author_created
  on reviews (author_id, created_at desc)
  where reverted = false;

-- D71 recompute 의 restaurant.office_id 필터 — restaurants 의 partial idx
-- (폐업 식당도 commit 카운팅엔 들어가야 하지만 일반적인 1위 계산엔 활성 식당만 의미)
create index if not exists idx_restaurants_office_active
  on restaurants (office_id)
  where is_closed = false;
