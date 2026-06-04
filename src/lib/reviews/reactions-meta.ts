// D79: reaction 이모지 화이트리스트.
// 'use server' 파일에 두면 client 가 import 시 RPC stub 으로 변환돼서 array 가 아니게 됨.
// 그래서 별도 일반 모듈로 분리 — client / server 양쪽에서 안전하게 import 가능.
// DB check constraint 와 같은 값 유지 필수.

export const REACTION_EMOJIS = ['❤️', '🤤', '🔥', '😋', '👀', '💯'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
