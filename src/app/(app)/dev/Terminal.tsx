'use client';

// D82: 가상 터미널 UI. Line[] (Segment[][]) 렌더링.

import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVfs, formatPath, lookup, resolvePath, type DevRestaurant, type DevReview, type DirNode } from '@/lib/dev/fs';
import { runCommand, type Theme, type DevPREvent } from '@/lib/dev/commands';
import { C, type Line } from '@/lib/dev/colors';
import type { CuisineItem } from '@/lib/cuisine';
import type { Office } from '@/types/db';

// D82 v4: Tab autocomplete — 명령어 + 경로
const ALL_COMMANDS = [
  'pwd', 'ls', 'cd', 'cat', 'git', 'grep', 'find', 'whoami', 'date',
  'history', 'clear', 'help', 'tree', 'wc', 'head', 'tail', 'echo',
  'uname', 'uptime', 'env', 'finger', 'myself', 'random', 'near',
  'trending', 'leaderboard', 'fortune', 'lolcat', 'theme', 'cowsay',
  'sudo', 'vim', 'nvim', 'emacs', 'nano', 'apt', 'brew', 'npm',
];
const PATH_COMMANDS = new Set(['cd', 'ls', 'cat', 'grep', 'find', 'wc', 'head', 'tail', 'tree']);

function longestCommonPrefix(strs: string[]): string {
  if (strs.length === 0) return '';
  let prefix = strs[0]!;
  for (const s of strs.slice(1)) {
    while (!s.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (!prefix) return '';
  }
  return prefix;
}

function pathCandidates(partial: string, root: DirNode, cwd: string[]): string[] {
  const isAbsolute = partial.startsWith('/');
  const segments = partial.split('/');
  const lastSeg = segments[segments.length - 1] ?? '';
  const dirSegs = segments.slice(0, -1);
  let parentParts: string[];
  if (isAbsolute) parentParts = dirSegs.filter(Boolean);
  else parentParts = resolvePath(cwd, dirSegs.join('/') || '.');
  const parent = lookup(root, parentParts);
  if (!parent || parent.type !== 'dir') return [];
  const prefix = (isAbsolute ? '/' : '') + (dirSegs.length > 0 ? dirSegs.filter(Boolean).join('/') + '/' : '');
  const matches: string[] = [];
  for (const c of parent.entries.values()) {
    if (!c.name.startsWith(lastSeg)) continue;
    matches.push(prefix + c.name + (c.type === 'dir' ? '/' : ''));
  }
  return matches.sort((a, b) => a.localeCompare(b, 'ko'));
}

interface Props {
  restaurants: DevRestaurant[];
  reviews: DevReview[];
  prEvents: DevPREvent[];
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

export function Terminal({ restaurants, reviews, prEvents, offices, cuisineItems, currentUserName, originLat, originLng }: Props) {
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
      prEvents,
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

  function handleTab() {
    const parts = input.split(/\s+/);
    const lastWord = parts[parts.length - 1] ?? '';
    const isFirstWord = parts.length === 1;
    const cmd = parts[0] ?? '';

    let candidates: string[] = [];
    if (isFirstWord) {
      candidates = ALL_COMMANDS.filter((c) => c.startsWith(lastWord));
    } else if (PATH_COMMANDS.has(cmd)) {
      candidates = pathCandidates(lastWord, root, cwd);
    }
    // git subcommand
    else if (cmd === 'git' && parts.length === 2) {
      candidates = ['log', 'show', 'contributors', 'stats', 'branch', 'checkout']
        .filter((c) => c.startsWith(lastWord));
    } else if (cmd === 'git' && (parts[1] === 'log' || parts[1] === 'contributors')) {
      candidates = pathCandidates(lastWord, root, cwd);
    } else if (cmd === 'theme') {
      candidates = ['matrix', 'amber', 'classic'].filter((c) => c.startsWith(lastWord));
    }

    if (candidates.length === 0) return;
    if (candidates.length === 1) {
      const completion = candidates[0]!;
      const newInput = parts.slice(0, -1).concat([completion]).join(' ');
      // dir 면 trailing slash 유지, 명령어/file 이면 공백 추가
      const trailing = completion.endsWith('/') ? '' : ' ';
      setInput(newInput + trailing);
    } else {
      // 공통 prefix 만큼 확장
      const common = longestCommonPrefix(candidates);
      if (common.length > lastWord.length) {
        const newInput = parts.slice(0, -1).concat([common]).join(' ');
        setInput(newInput);
      } else {
        // history 에 후보 목록 표시 (실제 입력은 그대로)
        const segs: Line = [];
        candidates.forEach((c, i) => {
          segs.push({ text: c, cls: c.endsWith('/') ? C.dir : '' });
          if (i < candidates.length - 1) segs.push('  ');
        });
        setHistory((h) => [
          ...h,
          { promptLine: [...promptSegs(), input], output: [segs] },
        ]);
      }
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setHistory([]);
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      handleTab();
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
