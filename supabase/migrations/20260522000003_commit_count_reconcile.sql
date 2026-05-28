-- commit_count 정합성 재조정.
-- 마부자생삼겹살김치찌개: 활성 리뷰 5개인데 commit_count=3 으로 박혀있던 사례 발견.
-- 트리거가 일부 INSERT 를 놓친 듯 (정확한 시점 추적 불가). 한 번 reconcile.
--
-- 또한 트리거 자체에 두 가지 보강:
-- 1) parent_review_id is not null 인 답글은 식당 commit 으로 카운트하지 않음.
--    답글은 부모 commit 에 대한 reply 일 뿐 새 commit 이 아님.
-- 2) UPDATE 시 parent_review_id flip 도 추적 (이론상 안 일어나지만 안전).

create or replace function bump_restaurant_commit_stats()
returns trigger
language plpgsql
as $$
declare
  was_active boolean;
  is_active boolean;
begin
  if (tg_op = 'INSERT') then
    if (not new.reverted and new.parent_review_id is null) then
      update restaurants
         set commit_count = commit_count + 1,
             last_commit_at = greatest(last_commit_at, new.created_at)
       where id = new.restaurant_id;
    end if;
    return new;

  elsif (tg_op = 'DELETE') then
    if (not old.reverted and old.parent_review_id is null) then
      update restaurants
         set commit_count = greatest(commit_count - 1, 0),
             last_commit_at = (
               select max(created_at) from reviews
                 where restaurant_id = old.restaurant_id
                   and not reverted
                   and parent_review_id is null
             )
       where id = old.restaurant_id;
    end if;
    return old;

  elsif (tg_op = 'UPDATE') then
    was_active := (not old.reverted) and (old.parent_review_id is null);
    is_active  := (not new.reverted) and (new.parent_review_id is null);
    if (was_active and not is_active) then
      update restaurants
         set commit_count = greatest(commit_count - 1, 0),
             last_commit_at = (
               select max(created_at) from reviews
                 where restaurant_id = new.restaurant_id
                   and not reverted
                   and parent_review_id is null
             )
       where id = new.restaurant_id;
    elsif (not was_active and is_active) then
      update restaurants
         set commit_count = commit_count + 1,
             last_commit_at = greatest(last_commit_at, new.created_at)
       where id = new.restaurant_id;
    end if;
    return new;
  end if;
  return null;
end;
$$;

-- 전체 식당의 commit_count / last_commit_at 을 실제 활성 root 리뷰 기준으로 재계산.
update restaurants r
set
  commit_count = coalesce((
    select count(*)::int from reviews
      where restaurant_id = r.id
        and not reverted
        and parent_review_id is null
  ), 0),
  last_commit_at = (
    select max(created_at) from reviews
      where restaurant_id = r.id
        and not reverted
        and parent_review_id is null
  );
