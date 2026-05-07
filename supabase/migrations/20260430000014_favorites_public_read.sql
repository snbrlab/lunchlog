-- D50: 다른 사용자의 찜 목록도 프로필 페이지에서 볼 수 있도록 RLS 완화
-- 사내 도구라 찜 정보는 비밀이 아님 — "어디 가볼지 영감" 공유 차원
-- insert/delete 는 여전히 본인만 (D44 정책 유지)

drop policy if exists "favorites: read self" on favorites;

create policy "favorites: read for authenticated"
  on favorites for select to authenticated using (true);
