'use client';

// D82: 가상 터미널 UI. Line[] (Segment[][]) 렌더링.

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVfs, formatPath, type DevRestaurant, type DevReview } from '@/lib/dev/fs';
import { runCommand, type Theme } from '@/lib/dev/commands';
import { C, type Line } from '@/lib/dev/colors';
import type { CuisineItem } from '@/lib/cuisine';
import type { Office } from '@/types/db';

interface Props {
  restaurants: DevRestaurant[];
  reviews: DevReview[];
  offices: Office[];
  cuisineItems: CuisineItem[];
  currentUserName: string;
  originLat: number;
  originLng: number;
}

const THEME_CLS: Record<Theme, string> = {
  matrix: 'border-emerald-700 bg-black text-emerald-300',
  amber: 'border-amber-700 bg-stone-950 text-amber-300',
  classic: 'border-neutral-600 bg-neutral-950 text-neutral-200',
};

interface HistoryEntry {
  promptLine: Line; // 입력 라인 (prompt + 명령)
  output: Line[];
}

const WELCOME: Line[] = [
  [{ text: '🖥️  lunchlog dev mode v0.3', cls: C.accent }],
  [''],
  ['디렉토리 구조: /<사옥>/<점심|저녁>/<cuisine>/<식당>/<file>'],
  [
    '"help" 로 전체 명령어. ↑/↓ history. Ctrl+L clear. theme matrix/amber/classic.',
  ],
  ['"trending", "leaderboard", "near 0.5", "random 한식", "fortune" 등 시도해보세요.'],
  [''],
];

export function Terminal({ restaurants, reviews, offices, cuisineItems, currentUserName, originLat, originLng }: Props) {
  const root = useMemo(
    () => buildVfs(restaurants, offices, cuisineItems),
    [restaurants, offices, cuisineItems],
  );

  const [cwd, setCwd] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { promptLine: [], output: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [theme, setTheme] = useState<Theme>('matrix');
  const startedAtRef = useRef<number>(Date.now());

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  function promptSegs(): Line {
    return [
      { text: 'lunchlog', cls: C.prompt_user },
      { text: ':', cls: C.dim },
      { text: formatPath(cwd), cls: C.prompt_path },
      { text: ' $ ', cls: C.prompt_dollar },
    ];
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cmd = input;
    setInput('');
    if (!cmd.trim()) {
      setHistory((h) => [...h, { promptLine: [...promptSegs(), cmd], output: [] }]);
      return;
    }
    const nextCmdHistory = [...cmdHistory, cmd];
    setCmdHistory(nextCmdHistory);
    setHistoryIdx(-1);

    const ctx = {
      root,
      cwd,
      reviews,
      cmdHistory: nextCmdHistory,
      currentUserName,
      originLat,
      originLng,
      startedAt: startedAtRef.current,
      setCwd,
      clear: () => setHistory([]),
      setTheme,
    };
    const result = runCommand(cmd, ctx);
    setHistory((h) => [...h, { promptLine: [...promptSegs(), cmd], output: result.lines }]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setHistory([]);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const next = historyIdx < 0 ? cmdHistory.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setInput(cmdHistory[next] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < 0) return;
      const next = historyIdx + 1;
      if (next >= cmdHistory.length) {
        setHistoryIdx(-1);
        setInput('');
      } else {
        setHistoryIdx(next);
        setInput(cmdHistory[next] ?? '');
      }
    }
  }

  return (
    <div
      ref={scrollRef}
      onClick={() => inputRef.current?.focus()}
      className={`flex flex-1 flex-col overflow-y-auto rounded-lg border px-3 py-2 font-mono text-[12px] leading-tight sm:text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${THEME_CLS[theme]}`}
    >
      {history.map((h, i) => (
        <div key={i}>
          {h.promptLine.length > 0 && <LineView line={h.promptLine} />}
          {h.output.map((line, j) => (
            <LineView key={j} line={line} />
          ))}
        </div>
      ))}
      <form onSubmit={onSubmit} className="flex">
        <LineView line={promptSegs()} inline />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent font-mono text-[12px] leading-tight outline-none sm:text-[13px] text-inherit"
        />
      </form>
    </div>
  );
}

function LineView({ line, inline = false }: { line: Line; inline?: boolean }) {
  const content = line.map((seg, i) =>
    typeof seg === 'string' ? (
      <span key={i}>{seg}</span>
    ) : (
      <span key={i} className={seg.cls}>
        {seg.text}
      </span>
    ),
  );
  if (inline) return <span className="shrink-0 whitespace-pre">{content}</span>;
  return <div className="whitespace-pre-wrap">{content}</div>;
}
