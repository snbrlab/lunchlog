-- revert 의 24h 제약 제거. 본인 글이면 언제든 revert 가능 (DB 행 보존이라 history 유지)
-- delete 는 여전히 admin only

drop policy if exists "reviews: update self within 24h or admin" on reviews;

create policy "reviews: update self or admin"
  on reviews for update to authenticated
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());

-- 참고: 현재 message 수정 UI 는 없으므로 결과적으로 revert (= reverted 컬럼 토글) 용도.
-- 추후 message 수정 기능 추가 시 24h 정책 재논의.
