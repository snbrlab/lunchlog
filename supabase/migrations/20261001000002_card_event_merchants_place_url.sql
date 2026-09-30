-- 카카오맵 "장소 상세(리뷰/메뉴 포함)" 페이지 링크. 좌표 핀 링크(map.kakao.com/link/map/...)와
-- 달리 place.map.kakao.com/{id} 형태라 리뷰/사진/메뉴까지 바로 보임.
-- 키워드검색으로 찾은 경우에만 카카오가 place_url 을 주고, 주소검색 fallback 이나
-- 런치로그 기존 식당 이름매칭으로 좌표를 빌려온 경우엔 없을 수 있음(그럴 땐 null).

alter table card_event_merchants
  add column kakao_place_url text;
