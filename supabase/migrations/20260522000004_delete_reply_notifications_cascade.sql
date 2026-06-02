-- D74 보강: 답글 삭제 시 그에 연결된 review_reply 노티도 같이 삭제.
-- 기존엔 INSERT 트리거만 있어서 답글이 사라져도 받은 사람의 노티 목록엔
-- "X님 답글" 이 남고, 클릭 시 깨진 링크 (/map?focus=restaurant) 가 됨.

create or replace function delete_reply_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.parent_review_id is not null then
    delete from notifications
     where type = 'review_reply'
       and (payload->>'reply_review_id')::uuid = old.id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_review_reply_delete on reviews;
create trigger trg_review_reply_delete
after delete on reviews
for each row execute function delete_reply_notifications();

-- 기존에 이미 깨진 노티가 있다면 정리 — payload 의 reply_review_id 가
-- 더 이상 존재하지 않는 review 를 가리키는 것만 삭제.
delete from notifications n
 where n.type = 'review_reply'
   and not exists (
     select 1 from reviews r
      where r.id = (n.payload->>'reply_review_id')::uuid
   );
