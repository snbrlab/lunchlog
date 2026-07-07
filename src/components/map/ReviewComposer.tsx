'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useMealMode } from '@/lib/meal-mode/MealModeProvider';
import { generateCommitHash } from '@/lib/hash';
import { createReview } from '@/lib/reviews/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { MealMode } from '@/types/db';

// D75: @멘션 — 입력 중 "@..." 패턴 감지 → 사용자 typeahead.
// 모듈 캐시 + 5분 TTL. 이전엔 limit 500 이라 700명 이상 조직에선 뒤쪽 이름들이 안 잡히던 버그 있었음.
let cachedUsers: { data: { id: string; name: string }[]; at: number } | null = null;
const USERS_TTL_MS = 5 * 60 * 1000;

async function fetchUsersOnce() {
  if (cachedUsers && Date.now() - cachedUsers.at < USERS_TTL_MS) return cachedUsers.data;
  const supabase = createSupabaseBrowserClient();
  // limit 제거 — 전체 fetch. 700명 기준 ~30KB 로 저렴.
  const { data } = await supabase.from('users').select('id, name').order('name');
  const arr = (data ?? []) as { id: string; name: string }[];
  cachedUsers = { data: arr, at: Date.now() };
  return arr;
}

// 현재 cursor 위치 직전의 @nickname 부분 (있으면) 추출. 없으면 null.
function detectMention(value: string, caret: number): { start: number; query: string } | null {
  // caret 직전부터 거꾸로 — @ 만나기 전까지 [\w가-힣] 만 허용
  let i = caret - 1;
  while (i >= 0 && /[\w가-힣]/.test(value[i]!)) i--;
  if (i < 0 || value[i] !== '@') return null;
  // @ 앞은 공백/문장시작/구두점이어야 함 (이메일 등 오탐 방지)
  if (i > 0 && /[\w가-힣@]/.test(value[i - 1]!)) return null;
  return { start: i, query: value.slice(i + 1, caret) };
}

// 부모에 group 클래스 박혀있을 때 hover 시 위에 띄우는 작은 라벨.
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-1 text-[10px] font-medium text-bg opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100"
    >
      {children}
    </span>
  );
}

const MAX = 200;

// 답글 대상 정보 (UI 안내 + parent_review_id 전달용)
export interface ReplyTarget {
  id: string;
  hash: string;
  authorName: string;
}

interface Props {
  restaurantId: string;
  onCreated: () => void;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
}

export function ReviewComposer({ restaurantId, onCreated, replyTo, onCancelReply }: Props) {
  const { mode } = useMealMode();
  const [message, setMessage] = useState('');
  const [mealTime, setMealTime] = useState<MealMode>(mode);
  const [partySize, setPartySize] = useState<string>(''); // 빈 문자열 = 안 적음
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // D75: @멘션 typeahead
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  useEffect(() => {
    fetchUsersOnce().then(setUsers);
  }, []);
  const mentionMatches = mention
    ? users
        .filter((u) => u.name.toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 5)
    : [];

  // 사용자가 명시적 토글 안 했을 때 점심/저녁 모드 변경에 따라가도록 — 명시적 변경 후엔 고정.
  const [touched, setTouched] = useState(false);
  if (!touched && mealTime !== mode) setMealTime(mode);

  function onMessageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setMessage(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = detectMention(v, caret);
    setMention(m);
    setMentionIdx(0);
  }

  function pickMention(name: string) {
    if (!mention) return;
    const before = message.slice(0, mention.start);
    const after = message.slice(mention.start + 1 + mention.query.length);
    // 닉네임에 \w/한글 외 문자 (공백, /, -, . 등) 있으면 @[Name] 형태로 명시적 경계.
    // simple 이름이면 그대로 @Name. 둘 다 ReviewLog 렌더링 + DB 트리거가 인식.
    const needsBrackets = /[^\w가-힣]/.test(name);
    const inserted = needsBrackets ? `[${name}]` : name;
    const newValue = `${before}@${inserted} ${after}`;
    setMessage(newValue);
    setMention(null);
    // cursor 를 멘션 직후로 이동
    const newCaret = before.length + 1 + inserted.length + 1;
    setTimeout(() => {
      inputRef.current?.setSelectionRange(newCaret, newCaret);
      inputRef.current?.focus();
    }, 0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!mention || mentionMatches.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIdx((i) => (i + 1) % mentionMatches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIdx((i) => (i - 1 + mentionMatches.length) % mentionMatches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      const pick = mentionMatches[mentionIdx];
      if (pick) {
        e.preventDefault();
        pickMention(pick.name);
      }
    } else if (e.key === 'Escape') {
      setMention(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    let parsedSize: number | null = null;
    if (partySize.trim()) {
      const n = Number(partySize);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        alert('인원수는 1~99 사이여야 해요');
        return;
      }
      parsedSize = n;
    }
    const hash = generateCommitHash();
    startTransition(async () => {
      const r = await createReview({
        restaurantId,
        message: trimmed,
        mealTime,
        partySize: parsedSize,
        hash,
        parentReviewId: replyTo?.id ?? null,
      });
      if (!r.ok) {
        alert(r.message);
        return;
      }
      setMessage('');
      setPartySize('');
      onCreated();
    });
  }

  return (
    <div className="relative z-10 shrink-0 border-t border-border bg-bg max-lg:pb-[max(env(safe-area-inset-bottom),0.625rem)]">
      {replyTo && (
        <div className="flex items-center gap-1.5 border-b border-border bg-fg/5 px-5 py-1.5 text-[11px] text-fg-muted">
          <span>↪ 답글 to</span>
          <span className="font-mono text-fg/80">{replyTo.hash}</span>
          <span>·</span>
          <span className="font-medium text-fg">{replyTo.authorName}</span>
          <button
            type="button"
            onClick={onCancelReply}
            disabled={pending}
            aria-label="답글 취소"
            className="ml-auto rounded px-1.5 py-0.5 text-fg-muted hover:bg-fg/10 hover:text-fg disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-stretch gap-2 px-5 py-2.5 max-sm:gap-y-1.5"
      >
        <div className="relative min-w-0 flex-1 basis-full sm:basis-0">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={onMessageChange}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setMention(null), 150)}
            placeholder={replyTo ? `${replyTo.authorName} 의 commit 에 답글…` : '한 줄 리뷰… (@닉네임 으로 멘션)'}
            maxLength={MAX}
            disabled={pending}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted/70 outline-none transition focus:border-fg disabled:opacity-50"
            aria-label="리뷰 메시지"
          />
          {mention && mentionMatches.length > 0 && (
            <ul
              role="listbox"
              className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs rounded-md border border-border bg-bg shadow-lg ring-1 ring-black/5"
            >
              {mentionMatches.map((u, i) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickMention(u.name)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition ${
                      i === mentionIdx ? 'bg-fg/10' : 'hover:bg-fg/5'
                    }`}
                  >
                    <span aria-hidden className="text-fg-muted">@</span>
                    <span className="font-medium text-fg">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      {/* 방문 인원 (선택) */}
      <div className="group relative">
        <Tooltip>몇명이서 갔는지 (선택)</Tooltip>
        <input
          type="number"
          min={1}
          max={99}
          step={1}
          inputMode="numeric"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          placeholder="👥"
          disabled={pending}
          aria-label="방문 인원 (선택)"
          title="몇명이서 갔는지 (선택)"
          className="h-9 w-12 rounded-md border border-border bg-surface px-1 text-center text-sm text-fg placeholder:text-base placeholder:text-fg-muted/60 outline-none transition focus:border-fg disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      <div className="group relative">
        <Tooltip>{mealTime === 'lunch' ? '점심으로 작성' : '저녁으로 작성'} (클릭으로 전환)</Tooltip>
        <button
          type="button"
          onClick={() => {
            setMealTime((m) => (m === 'lunch' ? 'dinner' : 'lunch'));
            setTouched(true);
          }}
          disabled={pending}
          aria-label={mealTime === 'lunch' ? '점심으로 작성' : '저녁으로 작성'}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-base hover:bg-fg/5 disabled:opacity-50"
        >
          {mealTime === 'lunch' ? '☀' : '☾'}
        </button>
      </div>

      <div className="group relative ml-auto sm:ml-0">
        <Tooltip>한 줄 리뷰 등록 (Enter)</Tooltip>
        <button
          type="submit"
          disabled={pending || !message.trim()}
          className="h-9 rounded-md bg-fg px-4 text-xs font-semibold uppercase tracking-wider text-bg transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? '…' : replyTo ? 'reply' : 'commit'}
        </button>
      </div>

      </form>
    </div>
  );
}
