-- 식당 등록 시 카카오 places API 의 place_url 보관.
-- 디테일 패널의 외부 링크가 단순 좌표가 아닌 카카오의 식당 정보 페이지로 가도록.

alter table restaurants
  add column kakao_place_url text;
