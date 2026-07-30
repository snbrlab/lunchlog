-- 커뮤니티 Q&A "issue" — 궁금한 식당/지역에 대해 묻고 서로 답한다.
-- git issue 메타포: open/closed, #N 순번, 답변 = comment.
-- restaurant_id 있으면 '식당 이슈', 없으면 '지역 이슈'(office_id 로 판별). office_id 는 항상 채움(지역필터).

create table issues (
  id uuid primary key default gen_random_uuid(),
  issue_number bigint generated always as identity, -- 표시용 #N
  author_id uuid not null references users(id) on delete cascade,
  office_id uuid references offices(id) on delete set null, -- 지역 (식당이슈면 식당의 office 복사)
  restaurant_id uuid references restaurants(id) on delete set null, -- 식당이슈면 대상 식당
  body text not null check (char_length(body) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'closed')),
  -- close 시 "이 식당으로 해결" 선택 가능
  resolved_restaurant_id uuid references restaurants(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index idx_issues_status_created on issues(status, created_at desc);
create index idx_issues_office on issues(office_id);
create index idx_issues_restaurant on issues(restaurant_id) where restaurant_id is not null;

alter table issues enable row level security;

-- 커뮤니티 Q&A — 인증 사용자 전체 열람
create policy "issues: read authenticated"
  on issues for select to authenticated using (true);
-- 열기: 본인 명의로
create policy "issues: insert self"
  on issues for insert to authenticated with check (author_id = auth.uid());
-- 수정(close 등): 작성자 또는 admin
create policy "issues: update owner or admin"
  on issues for update to authenticated
  using (author_id = auth.uid() or is_admin())
  with check (author_id = auth.uid() or is_admin());
-- 삭제: 작성자 또는 admin
create policy "issues: delete owner or admin"
  on issues for delete to authenticated
  using (author_id = auth.uid() or is_admin());

-- 답변 (스레드)
create table issue_comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues(id) on delete cascade,
  author_id uuid references users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  restaurant_id uuid references restaurants(id) on delete set null, -- 답변이 추천하는 식당 (선택)
  created_at timestamptz not null default now()
);

create index idx_issue_comments_issue_created on issue_comments(issue_id, created_at);

alter table issue_comments enable row level security;

create policy "ic: read authenticated"
  on issue_comments for select to authenticated using (true);
create policy "ic: insert self"
  on issue_comments for insert to authenticated with check (author_id = auth.uid());

-- notifications type 확장: issue_answer(답변 도착) + issue_mention(issue 에서 @멘션)
-- issue 멘션은 앱(server action)에서 스캔해 insert — 리뷰 mention 트리거와 payload/링크가 달라 별도 타입.
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new',
    'report_comment', 'badge_earned', 'region_champion', 'mention',
    'pull_request_new', 'pull_request_resolved', 'issue_answer', 'issue_mention'
  ));

-- 답변 insert → 이슈 작성자에게 노티 (본인 답변은 skip)
create or replace function notify_on_issue_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asker uuid;
  v_number bigint;
begin
  select author_id, issue_number into v_asker, v_number
    from issues where id = new.issue_id;

  if v_asker is not null and v_asker <> new.author_id then
    insert into notifications (user_id, type, payload)
    values (
      v_asker,
      'issue_answer',
      jsonb_build_object(
        'issue_id', new.issue_id,
        'issue_number', v_number,
        'preview', left(new.body, 100)
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_issue_answer on issue_comments;
create trigger trg_issue_answer
after insert on issue_comments
for each row execute function notify_on_issue_answer();
