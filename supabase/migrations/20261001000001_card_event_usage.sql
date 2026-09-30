-- 카드사 이벤트(월 3회 캐시백) 개인 사용 기록. 카드사 시스템과 연동은 불가능하니
-- 순수 자기기록용 — "이번 달 어디서 썼는지" 만 기억하게 도와줌. 강제 차단은 안 함.

create table card_event_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  merchant_id uuid not null references card_event_merchants(id) on delete cascade,
  used_at date not null default current_date,
  amount numeric,
  created_at timestamptz not null default now()
);

create index idx_card_event_usage_user_month on card_event_usage(user_id, used_at desc);

alter table card_event_usage enable row level security;

-- 완전히 개인 기록 — 본인 것만 읽고 쓰고 지울 수 있음 (다른 사람 소비내역 안 보임)
create policy "card_event_usage: own select" on card_event_usage
  for select to authenticated
  using (user_id = auth.uid());

create policy "card_event_usage: own insert" on card_event_usage
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "card_event_usage: own update" on card_event_usage
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "card_event_usage: own delete" on card_event_usage
  for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on card_event_usage to authenticated;
