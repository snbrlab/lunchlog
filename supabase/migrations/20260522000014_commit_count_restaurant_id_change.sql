-- D78 후속: commit_count drift 재조정 + 트리거 강화.
-- migration 3 적용 후에도 61개 식당의 commit_count 가 실제 활성 root 리뷰 수와
-- 어긋나 있던 케이스 발견. 트리거가 review.restaurant_id 변경을 안 잡는 게
-- 원인일 가능성 (merge_restaurants 안에서만 수동 보정함). restaurant_id 변경
-- 자체를 trigger 가 직접 처리하게 강화.

create or replace function bump_restaurant_commit_stats()
returns trigger
language plpgsql
as $$
declare
  was_active boolean;
  is_active boolean;
  restaurant_changed boolean;
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
    restaurant_changed := (old.restaurant_id is distinct from new.restaurant_id);

    if (restaurant_changed) then
      -- restaurant_id 가 바뀜 — old 식당에서 빼고 new 식당에 더함 (active 인 동안만)
      if (was_active) then
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
      if (is_active) then
        update restaurants
           set commit_count = commit_count + 1,
               last_commit_at = greatest(last_commit_at, new.created_at)
         where id = new.restaurant_id;
      end if;
    else
      -- 같은 식당 안에서 revert/parent_review_id flip 만 변한 케이스 (기존 로직)
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
    end if;
    return new;
  end if;
  return null;
end;
$$;

-- 전체 reconcile — 현재 drift 한 61개 식당 정정.
update restaurants r set
  commit_count = coalesce((
    select count(*)::int from reviews
     where restaurant_id = r.id and not reverted and parent_review_id is null
  ), 0),
  last_commit_at = (
    select max(created_at) from reviews
     where restaurant_id = r.id and not reverted and parent_review_id is null
  );
