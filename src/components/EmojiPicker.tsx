'use client';

import { useState } from 'react';
import { EMOJI_POOL } from '@/lib/avatar-emoji';

// 풀의 인덱스 경계 (avatar-emoji.ts 의 카테고리 순서/개수와 동기 유지)
const CATEGORIES = [
  { label: '동물', from: 0, to: 40, icon: '🐱' },
  { label: '음식', from: 40, to: 80, icon: '🍙' },
  { label: '표정', from: 80, to: 104, icon: '😊' },
  { label: '사물', from: 104, to: 120, icon: '⭐' },
] as const;

interface Props {
  value: string;
  onChange: (next: string) => void;
  avatarColor: string;
}

export function EmojiPicker({ value, onChange, avatarColor }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);
  const cat = CATEGORIES[activeCategory]!;
  const items = EMOJI_POOL.slice(cat.from, cat.to);

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* 현재 선택 미리보기 */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{ backgroundColor: avatarColor }}
          aria-hidden
        >
          {value}
        </span>
        <span className="text-xs text-fg-muted">선택된 이모지</span>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex border-b border-border" role="tablist">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.label}
            type="button"
            role="tab"
            aria-selected={i === activeCategory}
            onClick={() => setActiveCategory(i)}
            className={`flex-1 px-2 py-2 text-xs transition ${
              i === activeCategory ? 'bg-fg/5 font-medium text-fg' : 'text-fg-muted hover:bg-fg/5'
            }`}
          >
            <span aria-hidden className="mr-1">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>

      {/* 그리드: 8열 고정 */}
      <div className="grid max-h-56 grid-cols-8 gap-1 overflow-y-auto p-2">
        {items.map((emoji) => {
          const selected = emoji === value;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => onChange(emoji)}
              aria-pressed={selected}
              aria-label={`이모지 ${emoji} 선택`}
              className={`flex h-9 w-9 items-center justify-center rounded text-xl transition ${
                selected ? 'bg-fg/10 ring-2 ring-fg' : 'hover:bg-fg/5'
              }`}
            >
              <span aria-hidden>{emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
