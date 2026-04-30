-- 인앱 노티 (D41)
-- 두 가지 트리거 케이스:
-- 1) admin 이 사용자 제보를 업데이트 (status / admin_note 변경) → 제보자에게 노티
-- 2) 사용자 commit 에 답글 commit 이 달림 (parent_review_id) → 부모 commit 작성자에게 노티

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('report_update', 'review_reply')),
  payload jsonb not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_unread
  on notifications(user_id, created_at desc)
  where read_at is null;
create index idx_notifications_user_all
  on notifications(user_id, created_at desc);

alter table notifications enable row level security;

-- 본인 노티만 읽기
create policy "notifications: read self"
  on notifications for select to authenticated
  using (user_id = auth.uid());

-- 본인 노티만 update (read_at 처리). user_id 변경은 with check 로 차단.
create policy "notifications: update self"
  on notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 본인 노티 삭제 가능 (선택 — 안 쓰면 read_at 으로 충분)
create policy "notifications: delete self"
  on notifications for delete to authenticated
  using (user_id = auth.uid());

-- INSERT 정책 없음. 트리거 (security definer) 만 insert.

-- ---------------------------------------------------------------
-- 트리거 1: 제보 admin 업데이트 → 제보자 노티
-- ---------------------------------------------------------------
create or replace function notify_on_report_admin_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- status 또는 admin_note 가 실제로 바뀐 경우만
  if (new.status is distinct from old.status)
     or (new.admin_note is distinct from old.admin_note) then
    insert into notifications (user_id, type, payload)
    values (
      new.author_id,
      'report_update',
      jsonb_build_object(
        'report_id', new.id,
        'category', new.category,
        'status', new.status,
        'admin_note', new.admin_note
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_report_admin_update on reports;
create trigger trg_report_admin_update
after update on reports
for each row execute function notify_on_report_admin_update();

-- ---------------------------------------------------------------
-- 트리거 2: 답글 commit 생성 → 부모 commit 작성자 노티
-- ---------------------------------------------------------------
create or replace function notify_on_review_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_author_id uuid;
  v_parent_hash text;
  v_reply_author_name text;
  v_restaurant_name text;
begin
  if new.parent_review_id is null then
    return new;
  end if;

  select author_id, hash
    into v_parent_author_id, v_parent_hash
    from reviews where id = new.parent_review_id;

  -- 본인 commit 에 본인이 답글이면 노티 안 보냄
  if v_parent_author_id is null or v_parent_author_id = new.author_id then
    return new;
  end if;

  select name into v_reply_author_name from users where id = new.author_id;
  select name into v_restaurant_name from restaurants where id = new.restaurant_id;

  insert into notifications (user_id, type, payload)
  values (
    v_parent_author_id,
    'review_reply',
    jsonb_build_object(
      'reply_review_id', new.id,
      'reply_hash', new.hash,
      'reply_author_id', new.author_id,
      'reply_author_name', v_reply_author_name,
      'parent_hash', v_parent_hash,
      'restaurant_id', new.restaurant_id,
      'restaurant_name', v_restaurant_name,
      'message', left(new.message, 100)
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_review_reply on reviews;
create trigger trg_review_reply
after insert on reviews
for each row execute function notify_on_review_reply();
