// 사용자명 기반 파스텔 색 결정 (SPEC 7-6)
// 클라이언트/서버 어디서든 동일 결과를 위해 결정적 해시 사용.

const PASTEL_PALETTE = [
  '#f8b4b4', // pink
  '#fbd38d', // peach
  '#fde68a', // butter
  '#bef264', // lime
  '#a7f3d0', // mint
  '#a5f3fc', // sky
  '#c7d2fe', // periwinkle
  '#ddd6fe', // lavender
  '#fbcfe8', // rose
  '#fcd34d', // amber
];

function hashString(input: string): number {
  // FNV-1a 32bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function avatarColorFor(seed: string): string {
  const idx = hashString(seed) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[idx]!;
}
