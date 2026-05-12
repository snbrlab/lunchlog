-- D54: 성능 인덱스 보강
--
-- 1) reviews(created_at desc) — /log 의 ORDER BY created_at DESC LIMIT 100
-- 2) reviews(author_id, created_at desc) — heatmap 의 author_id + created_at gte
-- 3) restaurants(last_commit_at desc nulls last) — /map 사이드바 정렬 키
--    캐시 hit 시엔 안 타지만 cold start / invalidate 직후 fresh fetch 빠르게

create index if not exists idx_reviews_created_desc
  on reviews (created_at desc);

create index if not exists idx_reviews_author_created
  on reviews (author_id, created_at desc);

create index if not exists idx_restaurants_last_commit
  on restaurants (last_commit_at desc nulls last);
