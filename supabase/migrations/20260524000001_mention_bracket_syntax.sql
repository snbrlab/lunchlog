-- D75 보강: 멘션 정규식이 @[Name] 형태도 인식하도록 확장.
-- 슬래시(/), 공백, 점(.) 등 \w·한글 외 문자 포함 닉네임은 composer 가 @[Name] 으로
-- wrap 해서 보내는데, 기존 정규식은 그걸 못 잡고 @ 만 chip 처리하던 버그.
--
-- 두 가지 형태 매칭:
--   1) @[Name with special chars]  (그룹 1)
--   2) @simpleName                  (그룹 2)
-- coalesce 로 어느 쪽이 잡혔든 사용.

create or replace function notify_on_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_groups text[];
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

  if new.parent_review_id is not null then
    select author_id into v_parent_author_id from reviews where id = new.parent_review_id;
  end if;

  select name into v_author_name from users where id = new.author_id;
  select name into v_restaurant_name from restaurants where id = new.restaurant_id;

  for v_groups in
    select regexp_matches(new.message, '@(?:\[([^\]]+)\]|([\w가-힣]+))', 'g')
  loop
    v_match := coalesce(v_groups[1], v_groups[2]);
    if v_match is null or v_match = '' then
      continue;
    end if;

    select id, name into v_target_id, v_target_name
      from users
     where lower(name) = lower(v_match)
     limit 1;

    if v_target_id is null then continue; end if;
    if v_target_id = new.author_id then continue; end if;
    if v_target_id = v_parent_author_id then continue; end if;
    if v_target_id = any(v_seen) then continue; end if;
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
