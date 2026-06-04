-- D79: 리뷰 reactions (GitHub 이슈/PR comment 의 reaction 패턴).
-- 한 사람이 같은 commit 에 여러 이모지 가능. 같은 이모지는 1회 (PK 충돌). 다시 누르면 토글로 제거.
-- 이모지는 화이트리스트 6개 — 자유 입력 막아서 카오스 방지.

create table if not exists review_reactions (
  review_id uuid not null references reviews(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🤤', '🔥', '😋', '👀', '💯')),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id, emoji)
);

-- review_id 로 join 자주 — count/group 쿼리 빠르게.
create index if not exists idx_review_reactions_review on review_reactions(review_id);
-- user 별 reaction 조회 (미래에 "내가 반응한 commit" 같은 거 만들 때)
create index if not exists idx_review_reactions_user on review_reactions(user_id, created_at desc);

-- RLS
alter table review_reactions enable row level security;

drop policy if exists "reactions: read all auth" on review_reactions;
create policy "reactions: read all auth"
  on review_reactions for select
  to authenticated
  using (true);

drop policy if exists "reactions: insert self" on review_reactions;
create policy "reactions: insert self"
  on review_reactions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "reactions: delete self" on review_reactions;
create policy "reactions: delete self"
  on review_reactions for delete
  to authenticated
  using (user_id = auth.uid());
