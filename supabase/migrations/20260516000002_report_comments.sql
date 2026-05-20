-- D69: 제보 댓글 스레드 (ping-pong)
-- 기존 reports.admin_note 단일 필드는 보존 (legacy display). 새 대화는 report_comments 로.
-- ping-pong 룰 (직전 댓글 author 가 본인이면 거부) 은 server action 에서 enforce.

create table if not exists report_comments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_report_comments_report_created
  on report_comments(report_id, created_at);

alter table report_comments enable row level security;

-- 읽기: 제보 작성자 본인 또는 admin
drop policy if exists "rc: read" on report_comments;
create policy "rc: read"
  on report_comments for select to authenticated
  using (
    exists (
      select 1 from reports r
      where r.id = report_id
        and (
          r.author_id = auth.uid()
          or exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
        )
    )
  );

-- 작성: author_id 가 본인이며, 그 제보의 작성자거나 admin 일 때
drop policy if exists "rc: insert" on report_comments;
create policy "rc: insert"
  on report_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      exists (select 1 from reports r where r.id = report_id and r.author_id = auth.uid())
      or exists (select 1 from users u where u.id = auth.uid() and u.role = 'admin')
    )
  );
-- delete 정책 없음 — 댓글 단위 삭제는 미허용. admin 이 제보 자체 삭제하면 cascade.

-- notifications type 확장: report_comment 추가
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new', 'report_comment'
  ));

-- 트리거: 댓글 insert 시 상대방에게 노티
create or replace function notify_on_report_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid;
  v_category text;
  v_is_admin boolean;
begin
  select author_id, category::text into v_reporter, v_category
    from reports where id = new.report_id;

  select coalesce((u.role = 'admin'), false) into v_is_admin
    from users u where u.id = new.author_id;

  if v_is_admin then
    -- admin 답글 → 제보자에게 노티 (본인이 본인 제보면 skip)
    if v_reporter is not null and v_reporter <> new.author_id then
      insert into notifications (user_id, type, payload)
      values (
        v_reporter,
        'report_comment',
        jsonb_build_object(
          'report_id', new.report_id,
          'category', v_category,
          'from', 'admin',
          'preview', left(new.body, 100)
        )
      );
    end if;
  else
    -- 사용자 답글 → 모든 admin 에게 (본인 admin 제외 — 어차피 위 분기로 안 옴)
    insert into notifications (user_id, type, payload)
    select u.id, 'report_comment',
      jsonb_build_object(
        'report_id', new.report_id,
        'category', v_category,
        'from', 'user',
        'preview', left(new.body, 100)
      )
    from users u
    where u.role = 'admin' and u.id <> new.author_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_report_comment on report_comments;
create trigger trg_report_comment
after insert on report_comments
for each row execute function notify_on_report_comment();
