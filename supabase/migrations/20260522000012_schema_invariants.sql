-- D80 보강: 스키마 invariant CHECK 일괄 추가.
-- 클라이언트/트리거가 못 막는 잘못된 데이터를 DB 가 입구에서 거부 (defense-in-depth).
-- 기존 row 에 위반이 있으면 ALTER 자체가 실패 → 발견 자체가 가치.

------------------------------------------------------------
-- 1) reviews — 빈 commit 방지, self-FK loop 방지
------------------------------------------------------------
alter table reviews
  add constraint reviews_message_nonempty
    check (char_length(btrim(message)) >= 1);

alter table reviews
  add constraint reviews_parent_not_self
    check (parent_review_id is null or parent_review_id <> id);

------------------------------------------------------------
-- 2) users — 닉네임 길이
------------------------------------------------------------
alter table users
  add constraint users_name_length
    check (char_length(btrim(name)) between 1 and 40);

------------------------------------------------------------
-- 3) restaurants — 빈 이름 / 음수 commit_count / 빈 categories /
--    추천 인원 순서
------------------------------------------------------------
alter table restaurants
  add constraint restaurants_name_length
    check (char_length(btrim(name)) between 1 and 100);

alter table restaurants
  add constraint restaurants_commit_count_nonneg
    check (commit_count >= 0);

alter table restaurants
  add constraint restaurants_categories_nonempty
    check (array_length(categories, 1) >= 1);

-- recommended_min_size / max_size 가 둘 다 set 이면 min <= max
-- 둘 중 하나만 NULL 이거나 둘 다 NULL 인 케이스는 통과
alter table restaurants
  add constraint restaurants_recommended_size_order
    check (
      recommended_min_size is null
      or recommended_max_size is null
      or recommended_min_size <= recommended_max_size
    );

------------------------------------------------------------
-- 4) pull_requests — kind 별 shape + 처리 일관성
------------------------------------------------------------
-- kind 별로 어떤 컬럼이 채워져야 하는지 규정.
-- source/target 은 식당 삭제 시 set null 가능하므로 NOT NULL 강제는 안 함 —
-- 다만 edit_payload 의 존재 여부는 kind 와 항상 맞아야 함.
alter table pull_requests
  add constraint pr_kind_payload_shape
    check (
      (kind = 'merge' and edit_payload is null)
      or (kind = 'edit' and edit_payload is not null)
    );

-- status='open' 이면 reviewed_by/at NULL, status<>'open' 이면 둘 다 NOT NULL
alter table pull_requests
  add constraint pr_resolved_consistency
    check (
      (status = 'open' and reviewed_by is null and reviewed_at is null)
      or (status <> 'open' and reviewed_by is not null and reviewed_at is not null)
    );
