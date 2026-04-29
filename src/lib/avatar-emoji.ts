// 프로필 이모지 풀 (총 120개) — 동물 40 + 음식 40 + 표정 24 + 사물 16
// 사용자가 NULL 인 동안엔 이름+id 해시로 결정적 자동 배정.

export const EMOJI_POOL = [
  // 동물 40
  '🐱', '🐶', '🐰', '🐻', '🦊', '🐼', '🦁', '🐧', '🐸', '🦄',
  '🐷', '🐮', '🐹', '🐨', '🐯', '🐺', '🐗', '🐴', '🦌', '🦒',
  '🦘', '🐭', '🐔', '🐤', '🐢', '🦋', '🐝', '🐞', '🐲', '🦏',
  '🦛', '🐠', '🐳', '🐬', '🦓', '🦅', '🦆', '🦉', '🦕', '🦈',
  // 음식 40
  '🍙', '🍣', '🍜', '🍕', '🍰', '☕', '🍔', '🍟', '🍩', '🥐',
  '🥑', '🍫', '🍇', '🍵', '🌮', '🥗', '🍝', '🥯', '🍞', '🥖',
  '🍪', '🍓', '🍑', '🥟', '🍱', '🌭', '🥨', '🧀', '🍤', '🍦',
  '🍨', '🍢', '🥧', '🥪', '🌯', '🍛', '🥣', '🍲', '🍿', '🥦',
  // 표정 24
  '😊', '😎', '🥳', '🤓', '😋', '🥰', '🤔', '😇',
  '😄', '😴', '🤗', '🥺', '😏', '😺', '🤤', '😆',
  '🥹', '😅', '😉', '😤', '🥲', '😬', '🫠', '🤪',
  // 사물 16
  '⭐', '🔥', '🌈', '🎨', '🚀', '💎', '🍀', '🎵',
  '🌸', '🌻', '🌙', '☀️', '🍂', '🌊', '✨', '🎈',
] as const;

export type EmojiPoolItem = (typeof EMOJI_POOL)[number];

function hashString(input: string): number {
  // FNV-1a 32bit (avatar-color 와 동일 알고리즘이지만 별도 이모지 인덱스용)
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function emojiFor(seed: string): EmojiPoolItem {
  const idx = hashString(`emoji:${seed}`) % EMOJI_POOL.length;
  return EMOJI_POOL[idx]!;
}

// 표시용: DB 값이 있으면 그걸, 없으면 자동 배정.
export function resolveAvatarEmoji(stored: string | null | undefined, seed: string): string {
  if (stored && stored.length > 0) return stored;
  return emojiFor(seed);
}
