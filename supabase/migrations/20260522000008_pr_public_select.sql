-- D78 보강: /log activity feed 에 PR 이벤트 표시를 위해 SELECT 정책을 전체 공개로.
-- (INSERT/UPDATE 권한은 그대로 — opener 본인 / admin 만)

drop policy if exists "pr: read self or admin" on pull_requests;

create policy "pr: read all authenticated" on pull_requests
  for select to authenticated
  using (true);
