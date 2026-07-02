-- 근본 원인 fix — bump_restaurant_commit_stats 트리거가 SECURITY DEFINER 없이 실행됨.
-- 결과: 일반 사용자가 남의 식당에 commit 하면 트리거의 restaurants UPDATE 가
-- RLS ('update by owner or admin') 로 조용히 차단 → 0 rows → commit_count 안 오름.
-- 다른 트리거들 (notify_*, champion, badge) 은 다 security definer 있는데 이거만 누락.

create or replace function bump_restaurant_commit_stats()
returns trigger
language plpgsql
security definer
set search_path = public
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

-- 현재 27개 drift 재조정
update restaurants r set
  commit_count = coalesce((
    select count(*)::int from reviews
     where restaurant_id = r.id and not reverted and parent_review_id is null
  ), 0),
  last_commit_at = (
    select max(created_at) from reviews
     where restaurant_id = r.id and not reverted and parent_review_id is null
  );
