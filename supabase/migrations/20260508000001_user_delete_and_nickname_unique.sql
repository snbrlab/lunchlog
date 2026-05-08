-- D53: 사용자 삭제 + 닉네임 중복 방지
--
-- 1) 리뷰는 D14 원칙대로 삭제하지 않고 보존 → reviews.author_id 를 nullable + on delete set null
-- 2) restaurants.created_by 도 동일 (이미 nullable, FK 만 재설정)
-- 3) users.name 에 case-insensitive unique 제약 (lower(trim(name)))

-- 1) reviews.author_id
alter table reviews drop constraint if exists reviews_author_id_fkey;
alter table reviews alter column author_id drop not null;
alter table reviews
  add constraint reviews_author_id_fkey
  foreign key (author_id) references users(id) on delete set null;

-- 2) restaurants.created_by
alter table restaurants drop constraint if exists restaurants_created_by_fkey;
alter table restaurants
  add constraint restaurants_created_by_fkey
  foreign key (created_by) references users(id) on delete set null;

-- 3) users.name unique (case-insensitive, trim).
--    같은 닉네임을 다른 케이스로 우회하는 거 방지.
--    이미 중복이 있으면 인덱스 생성 시 실패 → 수동 정리 필요.
create unique index if not exists idx_users_name_lower_unique
  on users (lower(btrim(name)));
