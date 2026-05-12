-- D61: 식당 카테고리 (cuisine items) 를 admin 이 추가/수정할 수 있도록 DB 화.
-- 그룹(한식/일식/...)은 코드에 그대로 두고, 그 안의 항목만 DB 로 관리.
--
-- group_label 은 코드의 CUISINE_GROUPS_META 와 일치해야 함 (app 측 검증).
-- value 는 unique — restaurants.cuisine_types 의 원소로 들어가는 값.
-- value 는 immutable 정책 (변경하면 기존 식당 데이터 깨짐). label/emoji 만 수정 가능.

create table if not exists cuisine_items (
  id uuid primary key default gen_random_uuid(),
  group_label text not null,
  value text not null unique,
  label text,
  emoji text,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cuisine_items_group_order
  on cuisine_items(group_label, display_order, value);

-- updated_at trigger
create or replace function set_cuisine_items_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_cuisine_items_updated_at on cuisine_items;
create trigger trg_cuisine_items_updated_at
  before update on cuisine_items
  for each row execute function set_cuisine_items_updated_at();

-- RLS: 누구나 read, admin 만 write.
alter table cuisine_items enable row level security;

drop policy if exists "cuisine_items: read all" on cuisine_items;
create policy "cuisine_items: read all"
  on cuisine_items for select
  to anon, authenticated
  using (true);

drop policy if exists "cuisine_items: admin write" on cuisine_items;
create policy "cuisine_items: admin write"
  on cuisine_items for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- 시드 — 현재 코드의 CUISINE_GROUPS 그대로.
insert into cuisine_items (group_label, value, label, emoji, display_order) values
  ('한식', '국밥', null, null, 1),
  ('한식', '찌개', null, null, 2),
  ('한식', '비빔밥', null, null, 3),
  ('한식', '김밥', null, '🍙', 4),
  ('한식', '분식', null, null, 5),
  ('한식', '떡볶이', null, null, 6),
  ('한식', '칼국수', null, null, 7),
  ('한식', '냉면', null, null, 8),
  ('한식', '족발보쌈', null, null, 9),
  ('한식', '닭발', null, null, 10),
  ('한식', '샤브샤브', null, null, 11),
  ('한식', '만두', null, null, 12),
  ('한식', '전', null, null, 13),
  ('한식', '한정식', null, null, 14),
  ('한식', '한식', '기타', null, 99),

  ('일식', '스시', null, null, 1),
  ('일식', '라멘', null, null, 2),
  ('일식', '돈카츠', null, null, 3),
  ('일식', '우동', null, null, 4),
  ('일식', '오마카세', null, null, 5),
  ('일식', '이자카야', null, null, 6),
  ('일식', '일식카레', null, null, 7),
  ('일식', '일식', '기타', null, 99),

  ('중식', '짜장면/짬뽕', null, null, 1),
  ('중식', '마라탕', null, null, 2),
  ('중식', '딤섬', null, null, 3),
  ('중식', '훠궈', null, null, 4),
  ('중식', '중식', '기타', null, 99),

  ('양식', '파스타', null, null, 1),
  ('양식', '스테이크', null, null, 2),
  ('양식', '샐러드', null, null, 3),
  ('양식', '브런치', null, null, 4),
  ('양식', '멕시칸', null, null, 5),
  ('양식', '양식', '기타', null, 99),

  ('아시아', '쌀국수', null, null, 1),
  ('아시아', '팟타이', null, null, 2),
  ('아시아', '인도카레', null, null, 3),
  ('아시아', '분짜', null, null, 4),

  ('고기', '삼겹살', null, null, 1),
  ('고기', '소고기', null, null, 2),
  ('고기', '육회', null, null, 3),
  ('고기', '갈비', null, null, 4),
  ('고기', '양고기', null, null, 5),
  ('고기', '오리', null, null, 6),
  ('고기', '곱창', null, null, 7),
  ('고기', '장어', null, null, 8),
  ('고기', '닭갈비', null, null, 9),

  ('해산물', '회', null, null, 1),
  ('해산물', '조개구이', null, null, 2),
  ('해산물', '매운탕', null, null, 3),
  ('해산물', '해물찜', null, null, 4),

  ('치킨', '치킨', null, null, 1),
  ('피자', '피자', null, null, 1),
  ('버거', '햄버거', null, null, 1),

  ('카페/디저트', '커피', null, null, 1),
  ('카페/디저트', '베이커리', null, null, 2),
  ('카페/디저트', '디저트', null, null, 3),
  ('카페/디저트', '아이스크림', null, null, 4),
  ('카페/디저트', '카페', '기타', null, 99),

  ('술집', '술집', null, null, 1),
  ('뷔페', '뷔페', null, null, 1),
  ('기타', '기타', null, null, 1)
on conflict (value) do nothing;
