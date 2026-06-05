-- D78 버그 fix: source/target restaurant 삭제 시 PR 자체가 cascade 로 삭제되던 문제.
-- merge 실행 후 source 식당이 삭제되면 PR row 도 사라져서 history 가 안 남음.
-- FK 를 set null 로 변경 — PR 은 보존, source/target 만 null 처리 (UI 에서 "(삭제됨)" 표시).

alter table pull_requests
  drop constraint if exists pull_requests_source_id_fkey;
alter table pull_requests
  alter column source_id drop not null;
alter table pull_requests
  add constraint pull_requests_source_id_fkey
  foreign key (source_id) references restaurants(id) on delete set null;

alter table pull_requests
  drop constraint if exists pull_requests_target_id_fkey;
alter table pull_requests
  alter column target_id drop not null;
alter table pull_requests
  add constraint pull_requests_target_id_fkey
  foreign key (target_id) references restaurants(id) on delete set null;

-- CHECK (source_id <> target_id) 은 그대로 — 둘 중 하나라도 NULL 이면 NULL 평가 (CHECK pass).
