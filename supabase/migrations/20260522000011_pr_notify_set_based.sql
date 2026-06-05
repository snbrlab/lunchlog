-- D80 보강: notify_admins_on_pr_new 트리거의 admin loop → set-based INSERT 로 단순화.
-- admin 1명당 round-trip 1번 → set-based INSERT 1번. admin 수가 적어 큰 차이는 없지만
-- 패턴 일관성과 트리거 코드 단순화 측면.

create or replace function notify_admins_on_pr_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_opener_name text;
  v_source_name text;
  v_target_name text;
begin
  if new.status <> 'open' then
    return new;
  end if;

  select name into v_opener_name from users where id = new.opened_by;
  select name into v_source_name from restaurants where id = new.source_id;
  select name into v_target_name from restaurants where id = new.target_id;

  insert into notifications (user_id, type, payload)
  select
    u.id,
    'pull_request_new',
    jsonb_build_object(
      'pr_id', new.id,
      'kind', new.kind,
      'opener_name', v_opener_name,
      'source_name', v_source_name,
      'target_name', v_target_name,
      'reason', new.reason,
      'edit_payload', new.edit_payload
    )
   from users u
  where u.role = 'admin';

  return new;
end;
$$;
