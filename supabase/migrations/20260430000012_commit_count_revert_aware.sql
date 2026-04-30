-- commit_count 캐시를 revert flip 까지 따라가게 보강 + 한 번 reconciliation
--
-- 기존 trigger 는 INSERT / DELETE 만 처리하고 revert (UPDATE reverted=true) 는 무시함.
-- 그래서 사이드바 commit 카운트가 실제 활성 리뷰 수와 어긋나는 문제가 있었음.
-- 이 migration 이후로:
--   - INSERT: 새 row 가 reverted=false 면 +1
--   - DELETE: 삭제 row 가 reverted=false 였으면 -1
--   - UPDATE: reverted flip 시 +1 / -1
-- 그 후엔 캐시된 commit_count 를 그대로 신뢰하면 됨 (매 페이지마다 reviews 전수 카운트 불필요).

create or replace function bump_restaurant_commit_stats()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    if (not new.reverted) then
      update restaurants
         set commit_count = commit_count + 1,
             last_commit_at = greatest(last_commit_at, new.created_at)
       where id = new.restaurant_id;
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    if (not old.reverted) then
      update restaurants
         set commit_count = greatest(commit_count - 1, 0),
             last_commit_at = (
               select max(created_at) from reviews
                 where restaurant_id = old.restaurant_id and not reverted
             )
       where id = old.restaurant_id;
    end if;
    return old;

  elsif (tg_op = 'UPDATE') then
    -- revert flip 만 카운트에 영향. message / meal_time 변경 등은 카운트 무관.
    if (old.reverted is distinct from new.reverted) then
      if (new.reverted) then
        -- false → true: 활성 리뷰 -1
        update restaurants
           set commit_count = greatest(commit_count - 1, 0),
               last_commit_at = (
                 select max(created_at) from reviews
                   where restaurant_id = new.restaurant_id and not reverted
               )
         where id = new.restaurant_id;
      else
        -- true → false (revert 취소): 활성 리뷰 +1
        update restaurants
           set commit_count = commit_count + 1,
               last_commit_at = greatest(last_commit_at, new.created_at)
         where id = new.restaurant_id;
      end if;
    end if;
    return new;
  end if;
  return null;
end;
$$;

-- INSERT/DELETE 만 걸려있던 기존 trigger 를 UPDATE 까지 포함하게 재생성
drop trigger if exists trg_reviews_bump_stats on reviews;
create trigger trg_reviews_bump_stats
after insert or update or delete on reviews
for each row execute function bump_restaurant_commit_stats();

-- ---------------------------------------------------------------
-- Reconciliation: 모든 식당의 commit_count / last_commit_at 을
-- 실제 활성 리뷰(non-reverted) 기준으로 재계산.
-- 한 번만 실행하면 이후엔 trigger 가 정합성 유지.
-- ---------------------------------------------------------------
update restaurants r
set
  commit_count = coalesce((
    select count(*)::int from reviews
      where restaurant_id = r.id and not reverted
  ), 0),
  last_commit_at = (
    select max(created_at) from reviews
      where restaurant_id = r.id and not reverted
  );
