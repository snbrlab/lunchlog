'use client';

// @멘션 타입어헤드가 붙은 textarea. issue 본문/답변 공용.
// ponytail: ReviewComposer 의 멘션 로직을 복제(textarea 버전). 3번째 쓰임 생기면 공통 훅으로 추출.
import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

let cachedUsers: { data: { id: string; name: string }[]; at: number } | null = null;
const TTL = 5 * 60 * 1000;

async function fetchUsers() {
  if (cachedUsers && Date.now() - cachedUsers.at < TTL) return cachedUsers.data;
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.from('users').select('id, name').order('name');
  const arr = (data ?? []) as { id: string; name: string }[];
  cachedUsers = { data: arr, at: Date.now() };
  return arr;
}

// caret 직전의 @nickname 조각 추출 (없으면 null)
function detectMention(value: string, caret: number): { start: number; query: string } | null {
  let i = caret - 1;
  while (i >= 0 && /[\w가-힣]/.test(value[i]!)) i--;
  if (i < 0 || value[i] !== '@') return null;
  if (i > 0 && /[\w가-힣@]/.test(value[i - 1]!)) return null; // 이메일 등 오탐 방지
  return { start: i, query: value.slice(i + 1, caret) };
}

export function MentionTextarea({
  value,
  onChange,
  rows = 2,
  maxLength,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  const matches = mention
    ? users
        .filter((u) => u.name.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  function sync(v: string, caret: number) {
    onChange(v);
    setMention(detectMention(v, caret));
    setIdx(0);
  }

  function pick(name: string) {
    if (!mention) return;
    const before = value.slice(0, mention.start);
    const after = value.slice(mention.start + 1 + mention.query.length);
    const needsBrackets = /[^\w가-힣]/.test(name); // 공백/특수문자 닉네임은 @[Name]
    const inserted = needsBrackets ? `[${name}]` : name;
    const next = `${before}@${inserted} ${after}`;
    onChange(next);
    setMention(null);
    const caret = before.length + 1 + inserted.length + 1;
    setTimeout(() => {
      ref.current?.setSelectionRange(caret, caret);
      ref.current?.focus();
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || matches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const m = matches[idx];
      if (m) {
        e.preventDefault();
        pick(m.name);
      }
    } else if (e.key === 'Escape') {
      setMention(null);
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => sync(e.target.value, e.target.selectionStart ?? e.target.value.length)}
        onKeyDown={onKeyDown}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-fg"
      />
      {mention && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-56 overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
          {matches.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(u.name);
                }}
                className={`block w-full px-3 py-1.5 text-left text-xs ${
                  i === idx ? 'bg-fg/10' : 'hover:bg-fg/5'
                }`}
              >
                @{u.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
