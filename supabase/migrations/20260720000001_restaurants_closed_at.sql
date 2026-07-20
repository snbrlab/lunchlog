-- 폐업(아카이브) 시각. /log 활동 피드에 시간순으로 끼우려면 언제 닫았는지가 필요.
-- is_closed 토글 시 앱에서 set/null 한다 (닫으면 now(), 해제하면 null).
alter table restaurants add column if not exists closed_at timestamptz;

comment on column restaurants.closed_at is '폐업(아카이브) 처리 시각. is_closed=false 면 null';

-- 이미 폐업 처리된 식당 backfill — 정확한 시각을 알 수 없으므로 now() 로.
-- (이 기능 도입 직전에 처리된 건이라 근사치로 충분)
update restaurants set closed_at = now() where is_closed and closed_at is null;

create index if not exists idx_restaurants_closed_at
  on restaurants (closed_at desc)
  where closed_at is not null;
