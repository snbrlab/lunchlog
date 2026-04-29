-- Phase 1: commit_count / last_commit_at 자동 갱신 트리거 (SPEC 2.7)

create or replace function bump_restaurant_commit_stats()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    update restaurants
       set commit_count = commit_count + 1,
           last_commit_at = new.created_at
     where id = new.restaurant_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update restaurants
       set commit_count = greatest(commit_count - 1, 0),
           last_commit_at = (
             select max(created_at) from reviews where restaurant_id = old.restaurant_id
           )
     where id = old.restaurant_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger trg_reviews_bump_stats
after insert or delete on reviews
for each row execute function bump_restaurant_commit_stats();
