-- 브랜치 commit (D40): 다른 commit 에 대한 응답 commit
-- parent_review_id IS NULL  → 일반 root commit
-- parent_review_id NOT NULL → 그 commit 에 대한 답글 (1-level 만; UI 에서 강제)
-- on delete set null: 부모가 admin 에 의해 완전 삭제되면 자식은 root 로 격하 (DB 무결성 유지)

alter table reviews
  add column parent_review_id uuid,
  add constraint reviews_parent_review_id_fkey
    foreign key (parent_review_id) references reviews(id) on delete set null;

-- 답글 lookup 용 (자식 → 부모 조회는 PK, 부모 → 자식 조회는 이 인덱스)
create index idx_reviews_parent on reviews(parent_review_id) where parent_review_id is not null;
