-- 카드사 지역상권 이벤트(서울시 로컬브랜드 가맹점) 가맹점을 지도에 표시하고
-- 런치로그 기존 식당과 매칭하기 위한 테이블. import 는 scripts/import-card-event.mjs (service role) 로만 수행.
--
-- event_id 를 컬럼으로 뽑아둔 건 이번 이벤트(2026080030)가 끝나도 테이블 구조를 갈아엎지 않고
-- 다음 카드사 이벤트를 같은 테이블에 이어 넣을 수 있게 하기 위함.

create table card_event_merchants (
  id uuid primary key default gen_random_uuid(),
  event_id text not null default '2026080030',
  district text not null,               -- 'gwangjin' 등 원본 페이지의 data-type 코드
  district_label text not null,         -- '광진구(건대 청춘잇길)'
  name text not null,
  category text not null,               -- 원본 '업종' 문자열 그대로
  address text not null,
  latitude double precision,
  longitude double precision,
  geocode_status text not null default 'pending' check (geocode_status in ('pending', 'ok', 'failed')),

  -- 런치로그 기존 식당 매칭
  matched_restaurant_id uuid references restaurants(id) on delete set null,
  match_confidence text not null default 'none' check (match_confidence in ('auto', 'suggested', 'none')),
  reviewed boolean not null default false,   -- admin 이 한 번 확인했는지
  excluded boolean not null default false,   -- 식당이 아니거나(필터링 실패) 지도에 노출 안 할 항목

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (event_id, district, name, address)
);

create index idx_card_event_merchants_district on card_event_merchants(event_id, district);
create index idx_card_event_merchants_review_queue on card_event_merchants(reviewed) where reviewed = false;
create index idx_card_event_merchants_matched on card_event_merchants(matched_restaurant_id);

alter table card_event_merchants enable row level security;

-- SELECT: 로그인 유저 전체 공개 (지도 페이지에서 읽음)
create policy "card_event_merchants: read all" on card_event_merchants
  for select to authenticated
  using (true);

-- INSERT/DELETE 는 없음 — import 스크립트가 service role 로 직접 씀 (RLS 우회).
-- UPDATE: admin 만 (매칭 확정/거절/제외 처리)
create policy "card_event_merchants: update admin" on card_event_merchants
  for update to authenticated
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from users where id = auth.uid() and role = 'admin'));

grant select on card_event_merchants to authenticated;
grant update on card_event_merchants to authenticated;

create or replace function set_card_event_merchants_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_card_event_merchants_updated_at
before update on card_event_merchants
for each row execute function set_card_event_merchants_updated_at();
