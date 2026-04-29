-- reviews 에 방문 인원 추가 (선택). 혼밥/회식 패턴 파악용.

alter table reviews
  add column party_size int;

alter table reviews
  add constraint reviews_party_size_check
  check (party_size is null or (party_size between 1 and 99));
