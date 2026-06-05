-- D80: PR 에 edit kind 추가. 사용자가 식당 정보 수정도 제안할 수 있게.
-- merge PR: source/target 채움, edit_payload NULL
-- edit  PR: target_id 만 채움 (수정할 식당), source_id NULL, edit_payload 채움
--
-- edit_payload 예:
-- { "field": "name", "current": "계시", "new": "계시 본점" }
-- { "field": "price_level", "current": 1, "new": 2 }
-- { "field": "cuisine_types", "current": ["칼국수"], "new": ["칼국수", "소바"] }
-- { "field": "address", "current": "...", "new": "..." }
-- { "field": "has_alcohol", "current": false, "new": true }

alter table pull_requests
  add column if not exists kind text not null default 'merge'
    check (kind in ('merge', 'edit')),
  add column if not exists edit_payload jsonb;

-- 알림 트리거 — kind / edit_payload 도 payload 에 같이 박아서 UI 분기 가능하게.
create or replace function notify_admins_on_pr_new()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
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

  for v_admin_id in select id from users where role = 'admin' loop
    insert into notifications (user_id, type, payload)
    values (
      v_admin_id,
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
    );
  end loop;
  return new;
end;
$$;

create or replace function notify_opener_on_pr_resolved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_name text;
  v_target_name text;
begin
  if old.status = new.status then
    return new;
  end if;
  if new.status not in ('merged', 'closed') then
    return new;
  end if;

  select name into v_source_name from restaurants where id = new.source_id;
  select name into v_target_name from restaurants where id = new.target_id;

  insert into notifications (user_id, type, payload)
  values (
    new.opened_by,
    'pull_request_resolved',
    jsonb_build_object(
      'pr_id', new.id,
      'kind', new.kind,
      'status', new.status,
      'source_name', coalesce(v_source_name, '(삭제됨)'),
      'target_name', coalesce(v_target_name, '?'),
      'edit_payload', new.edit_payload
    )
  );
  return new;
end;
$$;
