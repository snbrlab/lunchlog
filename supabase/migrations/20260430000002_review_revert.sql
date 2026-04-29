-- 리뷰 revert 기능 + delete 권한 admin only 로 좁힘.
-- 일반 사용자는 24h 내 본인 글을 'revert' 만 가능 (strikethrough 표시, DB 행은 보존)
-- admin 만 진짜 delete 가능

alter table reviews
  add column reverted boolean not null default false;

-- 기존 delete 정책 교체
drop policy if exists "reviews: delete self within 24h or admin" on reviews;

create policy "reviews: delete admin only"
  on reviews for delete to authenticated
  using (is_admin());

-- update 정책은 그대로 (본인 24h or admin) — revert 처리는 update 라 OK
