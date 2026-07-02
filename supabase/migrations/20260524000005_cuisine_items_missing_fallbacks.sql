-- D80 보강: 일부 그룹에 fallback value = group_label 없어서
--            legacy cuisine_types 값이 join 실패로 카운트 누락되던 문제 해소.
--
-- 원인: 어류도감 등 오래된 식당이 cuisine_types=['해산물'] 로 저장돼있었는데
--       cuisine_items 에 value='해산물' row 가 없어서 badge_progress JOIN 실패.
--
-- 이미 있는 것: 한식/일식/중식/양식/카페(=카페/디저트) 는 '기타' 라벨로 fallback 존재.
--              치킨/피자/술집/뷔페 는 value=그룹이름 이 primary 로 존재 (특수).
--              버거는 value='햄버거' 라서 '버거' 로 저장된 legacy 는 fallback 필요.
-- 없는 것: 아시아 / 고기 / 해산물 / 버거

insert into cuisine_items (group_label, value, label, emoji, display_order) values
  ('아시아', '아시아', '기타', null, 99),
  ('고기', '고기', '기타', null, 99),
  ('해산물', '해산물', '기타', null, 99),
  ('버거', '버거', '기타', null, 99)
on conflict (value) do nothing;
