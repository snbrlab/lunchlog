-- 답변에서 추천하는 식당이 미등록일 때도 카카오맵 링크로 첨부 (issues.external_* 와 동일).
alter table issue_comments add column if not exists external_name text;
alter table issue_comments add column if not exists external_url text;

comment on column issue_comments.external_name is '답변 추천 식당이 미등록일 때 이름';
comment on column issue_comments.external_url is '답변 추천 식당 카카오맵 링크 (kakao 도메인만)';
