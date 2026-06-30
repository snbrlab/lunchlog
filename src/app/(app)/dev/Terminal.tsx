'use client';

// D82: 가상 터미널 UI. 입력 → runCommand → 출력.

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVfs, formatPath, type DevRestaurant, type DevReview } from '@/lib/dev/fs';
import { runCommand } from '@/lib/dev/commands';
import type { CuisineItem } from '@/lib/cuisine';
import type { Office } from '@/types/db';

interface Props {
  restaurants: DevRestaurant[];
  reviews: DevReview[];
  offices: Office[];
  cuisineItems: CuisineItem[];
}

interface HistoryEntry {
  prompt: string;
  output: string[];
}

const WELCOME = [
  '🖥️  lunchlog dev mode v0.1',
  '',
  '디렉토리 구조: /<사옥>/<점심|저녁>/<cuisine>/<식당>/<file>',
  '"help" 로 명령어 보기. "ls" 부터 시작해보세요.',
  '',
];

export function Terminal({ restaurants, reviews, offices, cuisineItems }: Props) {
  const root = useMemo(
    () => buildVfs(restaurants, offices, cuisineItems),
    [restaurants, offices, cuisineItems],
  );

  const [cwd, setCwd] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([
    { prompt: '', output: WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]); // 위/아래 화살표용
  const [historyIdx, setHistoryIdx] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  function prompt(): string {
    return `lunchlog:${formatPath(cwd)}$ `;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cmd = input;
    setInput('');
    if (!cmd.trim()) {
      setHistory((h) => [...h, { prompt: prompt() + cmd, output: [] }]);
      return;
    }
    setCmdHistory((ch) => [...ch, cmd]);
    setHistoryIdx(-1);

    const ctx = {
      root,
      cwd,
      reviews,
      setCwd,
      clear: () => setHistory([]),
    };
    const result = runCommand(cmd, ctx);
    setHistory((h) => [...h, { prompt: prompt() + cmd, output: result.lines }]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
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
      className="flex flex-1 flex-col overflow-y-auto rounded-lg border border-emerald-700 bg-black px-3 py-2 font-mono text-[12px] leading-tight text-emerald-300 sm:text-[13px]"
    >
      {history.map((h, i) => (
        <div key={i}>
          {h.prompt && <div className="whitespace-pre-wrap">{h.prompt}</div>}
          {h.output.map((line, j) => (
            <div key={j} className="whitespace-pre-wrap text-emerald-200">
              {line}
            </div>
          ))}
        </div>
      ))}
      <form onSubmit={onSubmit} className="flex">
        <span className="shrink-0 whitespace-pre">{prompt()}</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent text-emerald-300 outline-none"
        />
      </form>
    </div>
  );
}
