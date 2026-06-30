// D82 v2: 터미널 출력 색깔 — Tailwind 클래스 segments.

export type Segment = string | { text: string; cls: string };
export type Line = Segment[];

export const C = {
  dir: 'text-sky-300',
  hidden: 'text-emerald-500/50',
  hash: 'text-amber-300',
  date: 'text-emerald-500/60',
  author: 'text-cyan-300',
  error: 'text-red-400',
  warn: 'text-amber-200',
  revert: 'text-emerald-700 line-through',
  accent: 'text-amber-200 font-semibold',
  dim: 'text-emerald-400/60',
  prompt_path: 'text-sky-300',
  prompt_user: 'text-emerald-200',
  prompt_dollar: 'text-emerald-400 font-bold',
} as const;

export function seg(text: string, cls: string): Segment {
  return { text, cls };
}
