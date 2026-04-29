-- users 에 프로필 이모지 추가. NULL 이면 클라이언트가 이름 해시로 자동 결정.

alter table users
  add column avatar_emoji text;

-- 너무 긴 입력 막기 (최대 8자 = 멀티 codepoint 이모지 1~2개 정도까지 허용)
alter table users
  add constraint users_avatar_emoji_length_check
  check (avatar_emoji is null or char_length(avatar_emoji) <= 8);
