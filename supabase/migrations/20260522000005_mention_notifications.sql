-- D75: 멘션 (@user) 알림.
-- 리뷰 메시지에 @닉네임 패턴이 있으면 해당 user 에게 mention 노티.
-- 본인 멘션은 skip, 답글의 부모 작성자가 멘션되어도 review_reply 와 중복되지 않게 skip.

-- 1) notifications type 확장
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications
  add constraint notifications_type_check
  check (type in (
    'report_update', 'review_reply', 'signup_request_new', 'report_new',
    'report_comment', 'badge_earned', 'region_champion', 'mention'
  ));

-- 2) 멘션 추출 + 노티 트리거
-- 정규식: @ 뒤 ASCII word(영문/숫자/_) 또는 한글 (가-힣) 연속. 공백 없는 닉네임만 매칭.
create or replace function notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match text;
  v_target_id uuid;
  v_target_name text;
  v_author_name text;
  v_restaurant_name text;
  v_parent_author_id uuid;
  v_seen uuid[] := array[]::uuid[];
begin
  if new.message is null or new.message = '' then
    return new;
  end if;

  -- 답글이면 parent 작성자 ID 미리 확보 (중복 노티 방지용)
  if new.parent_review_id is not null then
    select author_id into v_parent_author_id from reviews where id = new.parent_review_id;
  end if;

  select name into v_author_name from users where id = new.author_id;
  select name into v_restaurant_name from restaurants where id = new.restaurant_id;

  -- 모든 @nickname 매칭 순회
  for v_match in
    select (regexp_matches(new.message, '@([\w가-힣]+)', 'g'))[1]
  loop
    -- 닉네임 → user_id (정확 일치, 대소문자 무시)
    select id, name into v_target_id, v_target_name
      from users
     where lower(name) = lower(v_match)
     limit 1;

    if v_target_id is null then
      continue;  -- 매칭되는 user 없음
    end if;
    if v_target_id = new.author_id then
      continue;  -- 본인 멘션 skip
    end if;
    if v_target_id = v_parent_author_id then
      continue;  -- 답글 부모작성자 멘션 → review_reply 노티와 중복 방지
    end if;
    if v_target_id = any(v_seen) then
      continue;  -- 같은 사람 여러번 멘션해도 노티 1개
    end if;
    v_seen := array_append(v_seen, v_target_id);

    insert into notifications (user_id, type, payload)
    values (
      v_target_id,
      'mention',
      jsonb_build_object(
        'review_id', new.id,
        'hash', new.hash,
        'author_id', new.author_id,
        'author_name', v_author_name,
        'restaurant_id', new.restaurant_id,
        'restaurant_name', v_restaurant_name,
        'message', left(new.message, 100)
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_review_mention on reviews;
create trigger trg_review_mention
after insert on reviews
for each row execute function notify_on_mention();

-- 3) 리뷰 DELETE 시 mention 노티도 cascade — 답글 cascade 와 같은 패턴
create or replace function delete_mention_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from notifications
   where type = 'mention'
     and (payload->>'review_id')::uuid = old.id;
  return old;
end;
$$;

drop trigger if exists trg_review_mention_delete on reviews;
create trigger trg_review_mention_delete
after delete on reviews
for each row execute function delete_mention_notifications();
