-- D79 보강: 놀란표정 😲 추가. CHECK constraint 갱신.

alter table review_reactions
  drop constraint if exists review_reactions_emoji_check;

alter table review_reactions
  add constraint review_reactions_emoji_check
  check (emoji in ('❤️', '🤤', '🔥', '😋', '👀', '😲', '💯'));
