// D82: 개발자 모드 — 명령어 파서 + 실행기.
// 출력은 Line[] = Segment[][] 로 색깔 segment 지원.

import {
  formatPath,
  lookup,
  resolvePath,
  type DevReview,
  type DirNode,
  type Node,
} from './fs';
import { C, seg, type Line } from './colors';

export interface CommandContext {
  root: DirNode;
  cwd: string[];
  reviews: DevReview[]; // 전체 리뷰
  cmdHistory: string[]; // history 명령용
  currentUserName: string; // whoami 용
  setCwd: (parts: string[]) => void;
  clear: () => void;
}

export interface CommandResult {
  lines: Line[];
}

const HELP: Line[] = [
  ['명령어:'],
  ['  pwd                  현재 경로'],
  ['  ls [path]            디렉토리 / 파일 목록'],
  ['  cd <path>            디렉토리 이동 (.., /, ~ OK)'],
  ['  cat <file>           파일 내용'],
  ['  git log [path]       commit 목록 (지역/식당)'],
  ['  git show <hash>      단일 commit 상세'],
  ['  git contributors [path]  작성자별 commit 카운트'],
  ['  git stats            전체 통계'],
  ['  grep <pat> [path]    파일 + commit 메시지 검색 (-i 대소문자 무시)'],
  ['  find <pattern>       이름으로 식당 찾기 (대소문자 무시, 부분 매치)'],
  ['  whoami               내 닉네임'],
  ['  date                 현재 KST'],
  ['  history              명령어 기록'],
  ['  clear (Ctrl+L)       화면 지우기'],
  ['  help                 이 도움말'],
  [''],
  ['구조: /<사옥>/<점심|저녁>/<cuisine>/<식당>/<file>'],
  ['예: cd /광화문/점심/한식/계시 → ls → cat README.md → git log'],
];

export function runCommand(input: string, ctx: CommandContext): CommandResult {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };

  const [cmd, ...rest] = trimmed.split(/\s+/);

  switch (cmd) {
    case 'help':
      return { lines: HELP };
    case 'clear':
      ctx.clear();
      return { lines: [] };
    case 'pwd':
      return { lines: [[seg(formatPath(ctx.cwd), C.prompt_path)]] };
    case 'ls':
      return runLs(rest, ctx);
    case 'cd':
      return runCd(rest[0], ctx);
    case 'cat':
      return runCat(rest[0], ctx);
    case 'git':
      return runGit(rest, ctx);
    case 'grep':
      return runGrep(rest, ctx);
    case 'find':
      return runFind(rest, ctx);
    case 'whoami':
      return { lines: [[seg(ctx.currentUserName || '익명', C.author)]] };
    case 'date':
      return { lines: [[runDate()]] };
    case 'history':
      return runHistory(ctx);

    // Easter eggs
    case 'sudo':
      return { lines: [[seg('🍱 sudo: 식사 맛있게 하세요', C.warn)]] };
    case 'rm':
      return rest.includes('-rf') || rest.includes('-r') || rest.includes('-f')
        ? { lines: [[seg('에이 왜그러십니까', C.error)]] }
        : { lines: [[seg('rm: ...님 그게 명령어가 됩니까', C.dim)]] };
    case 'vim':
    case 'nvim':
    case 'emacs':
    case 'nano':
      return {
        lines: [[seg(`${cmd}: 안 만들었어... 그냥 cat 으로 봐주세요`, C.dim)]],
      };
    case 'cowsay':
      return runCowsay(rest.join(' '));
    case 'apt':
    case 'apt-get':
    case 'brew':
    case 'npm':
    case 'yarn':
      return {
        lines: [
          [seg(`${cmd}: 패키지 매니저는 당신의 점심 선택지 입니다 🍱`, C.dim)],
        ],
      };

    default:
      return {
        lines: [
          [seg(`command not found: ${cmd}`, C.error)],
          [seg('"help" 로 사용 가능 명령어 확인', C.dim)],
        ],
      };
  }
}

// ---------------- ls / cd / cat ----------------

function runLs(args: string[], ctx: CommandContext): CommandResult {
  // 플래그 파싱: -a (숨김 포함), -l (long format), -al / -la 결합 OK
  const flags = new Set<string>();
  const positional: string[] = [];
  for (const a of args) {
    if (a.startsWith('-')) for (const c of a.slice(1)) flags.add(c);
    else positional.push(a);
  }
  const showHidden = flags.has('a');
  const longFormat = flags.has('l');
  const path = positional[0];

  const parts = path ? resolvePath(ctx.cwd, path) : ctx.cwd;
  const node = lookup(ctx.root, parts);
  if (!node) return errLine(`ls: ${path ?? formatPath(parts)}: 경로 없음`);
  if (node.type !== 'dir') return { lines: [[seg(node.name, C.dim)]] };

  const entries = Array.from(node.entries.values())
    .filter((e) => showHidden || !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'ko');
    });

  const lines: Line[] = [];
  for (const e of entries) {
    if (longFormat) {
      // 메타: restaurant 면 'commit N · 날짜', 일반 dir 면 child 수, file 면 byte 수
      let meta = '';
      if (e.type === 'dir') {
        if (e.restaurant) {
          const date = e.restaurant.last_commit_at
            ? e.restaurant.last_commit_at.slice(0, 10)
            : '         -';
          meta = `commit ${String(e.restaurant.commit_count).padStart(3)}  ${date}`;
        } else {
          meta = `         ${String(e.entries.size).padStart(3)} entries`;
        }
      } else {
        meta = `${String(e.content.length).padStart(8)} B`;
      }
      const isHidden = e.name.startsWith('.');
      const nameSeg =
        e.type === 'dir'
          ? seg(e.name + '/', C.dir)
          : seg(e.name, isHidden ? C.hidden : '');
      lines.push([seg(meta, C.dim), '  ', nameSeg]);
    } else {
      // 기본 ls: 이름만
      if (e.type === 'dir') {
        lines.push([seg(e.name + '/', C.dir)]);
      } else {
        const isHidden = e.name.startsWith('.');
        lines.push([seg(e.name, isHidden ? C.hidden : '')]);
      }
    }
  }
  return { lines };
}

function runCd(path: string | undefined, ctx: CommandContext): CommandResult {
  if (!path || path === '~') {
    ctx.setCwd([]);
    return { lines: [] };
  }
  const parts = resolvePath(ctx.cwd, path);
  const node = lookup(ctx.root, parts);
  if (!node) return errLine(`cd: ${path}: 경로 없음`);
  if (node.type !== 'dir') return errLine(`cd: ${path}: 디렉토리 아님`);
  ctx.setCwd(parts);
  return { lines: [] };
}

function runCat(path: string | undefined, ctx: CommandContext): CommandResult {
  if (!path) return errLine('cat: 파일 이름 필요');
  const parts = resolvePath(ctx.cwd, path);
  const node = lookup(ctx.root, parts);
  if (!node) return errLine(`cat: ${path}: 없음`);
  if (node.type !== 'file') return errLine(`cat: ${path}: 디렉토리`);
  return { lines: node.content.split('\n').map((l) => [l] as Line) };
}

// ---------------- git ----------------

function runGit(args: string[], ctx: CommandContext): CommandResult {
  const sub = args[0];
  switch (sub) {
    case 'log':
      return runGitLog(args.slice(1), ctx);
    case 'show':
      return runGitShow(args[1], ctx);
    case 'contributors':
      return runGitContributors(args[1], ctx);
    case 'stats':
      return runGitStats(ctx);
    default:
      return errLine(
        `git: '${sub ?? ''}' 명령 미지원. 'log' / 'show' / 'contributors' / 'stats'`,
      );
  }
}

function runGitLog(args: string[], ctx: CommandContext): CommandResult {
  const target = args.length >= 1 ? resolvePath(ctx.cwd, args[0]!) : ctx.cwd;
  const node = lookup(ctx.root, target);
  if (!node || node.type !== 'dir') {
    return errLine(`git log: ${formatPath(target)}: 디렉토리 없음`);
  }

  const restaurantIds = new Set<string>();
  const showRestaurantName = !node.restaurant;
  const nameById = new Map<string, string>();
  function collect(n: Node) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      restaurantIds.add(n.restaurant.id);
      if (showRestaurantName) nameById.set(n.restaurant.id, n.restaurant.name);
      return;
    }
    for (const c of n.entries.values()) collect(c);
  }
  collect(node);

  if (restaurantIds.size === 0) return { lines: [[seg('(식당 없음)', C.dim)]] };

  const commits = ctx.reviews
    .filter((rv) => restaurantIds.has(rv.restaurant_id) && rv.parent_review_id === null)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  if (commits.length === 0) return { lines: [[seg('(아직 commit 없음)', C.dim)]] };

  return { lines: commits.map((rv) => commitLogLine(rv, showRestaurantName ? (nameById.get(rv.restaurant_id) ?? null) : null)) };
}

function commitLogLine(rv: DevReview, restaurantName: string | null): Line {
  const dateStr = rv.created_at.slice(0, 10);
  const meal = rv.meal_time === 'lunch' ? '☀' : '🌙';
  const party = rv.party_size ? ` (${rv.party_size}명)` : '';
  const revertMark = rv.reverted ? ' [REVERTED]' : '';
  const author = rv.author_name ?? '?';
  const msg = rv.message.replace(/\n/g, ' ').slice(0, 80);
  const restaurantTag = restaurantName ? ` [${restaurantName}]` : '';

  const msgCls = rv.reverted ? C.revert : '';
  return [
    seg(rv.hash, C.hash),
    ' ',
    seg(dateStr, C.date),
    ' ',
    `${meal} `,
    seg(author, C.author),
    `${party}`,
    revertMark ? seg(revertMark, C.error) : '',
    `${restaurantTag}: `,
    msgCls ? seg(msg, msgCls) : msg,
  ];
}

function runGitShow(hash: string | undefined, ctx: CommandContext): CommandResult {
  if (!hash) return errLine('git show: hash 인자 필요');
  const rv = ctx.reviews.find((r) => r.hash.startsWith(hash));
  if (!rv) return errLine(`git show: ${hash}: commit 없음`);
  const restaurantId = rv.restaurant_id;

  // 식당 이름 찾기
  let restaurantName = '?';
  function findName(n: Node): void {
    if (n.type !== 'dir') return;
    if (n.restaurant?.id === restaurantId) {
      restaurantName = n.restaurant.name;
      return;
    }
    for (const c of n.entries.values()) findName(c);
  }
  findName(ctx.root);

  const meal = rv.meal_time === 'lunch' ? '☀ 점심' : '🌙 저녁';
  const party = rv.party_size ? `, ${rv.party_size}명` : '';
  const lines: Line[] = [
    [seg(`commit ${rv.hash}`, C.hash)],
    [seg('Author:     ', C.dim), seg(rv.author_name ?? '?', C.author)],
    [seg('Date:       ', C.dim), seg(rv.created_at.slice(0, 19), C.date), ` (${meal}${party})`],
    [seg('Restaurant: ', C.dim), seg(restaurantName, C.dir)],
  ];
  if (rv.reverted) lines.push([seg('Status:     ', C.dim), seg('REVERTED', C.error)]);
  lines.push(['']);
  rv.message.split('\n').forEach((l) => lines.push([`    ${l}`]));
  return { lines };
}

function runGitContributors(pathArg: string | undefined, ctx: CommandContext): CommandResult {
  const target = pathArg ? resolvePath(ctx.cwd, pathArg) : ctx.cwd;
  const node = lookup(ctx.root, target);
  if (!node || node.type !== 'dir') {
    return errLine(`git contributors: ${formatPath(target)}: 디렉토리 없음`);
  }
  const restaurantIds = new Set<string>();
  function collect(n: Node) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      restaurantIds.add(n.restaurant.id);
      return;
    }
    for (const c of n.entries.values()) collect(c);
  }
  collect(node);

  const counts = new Map<string, number>();
  for (const rv of ctx.reviews) {
    if (!restaurantIds.has(rv.restaurant_id)) continue;
    if (rv.parent_review_id) continue;
    if (rv.reverted) continue;
    const name = rv.author_name ?? '?';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return { lines: [[seg('(commit 없음)', C.dim)]] };

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const maxCount = sorted[0]![1];
  return {
    lines: sorted.map(([name, n]) => {
      const barLen = Math.max(1, Math.round((n / maxCount) * 20));
      return [
        seg(name.padEnd(20), C.author),
        seg(String(n).padStart(4), C.accent),
        '  ',
        seg('█'.repeat(barLen), C.hash),
      ];
    }),
  };
}

function runGitStats(ctx: CommandContext): CommandResult {
  const allRestaurants = collectAllRestaurants(ctx.root);
  const allActive = ctx.reviews.filter(
    (rv) => !rv.reverted && rv.parent_review_id === null,
  );

  // 최근 7일
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent7 = allActive.filter((rv) => new Date(rv.created_at).getTime() > cutoff).length;

  // top restaurant
  const byRestaurant = new Map<string, number>();
  for (const rv of allActive) {
    byRestaurant.set(rv.restaurant_id, (byRestaurant.get(rv.restaurant_id) ?? 0) + 1);
  }
  const topR = Array.from(byRestaurant.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const restById = new Map(allRestaurants.map((r) => [r.id, r.name]));

  // top author
  const byAuthor = new Map<string, number>();
  for (const rv of allActive) {
    const name = rv.author_name ?? '?';
    byAuthor.set(name, (byAuthor.get(name) ?? 0) + 1);
  }
  const topA = Array.from(byAuthor.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const lines: Line[] = [
    [seg('📊 lunchlog stats', C.accent)],
    [''],
    [seg('총 식당:        ', C.dim), seg(String(allRestaurants.length), C.accent)],
    [seg('총 commit:      ', C.dim), seg(String(allActive.length), C.accent)],
    [seg('최근 7일 commit:', C.dim), seg(' ' + String(recent7), C.accent)],
    [''],
    [seg('🔥 가장 많은 commit', C.warn)],
    ...topR.map(([id, n]) => [
      '  ',
      seg(String(n).padStart(3), C.accent),
      '  ',
      seg(restById.get(id) ?? '?', C.dir),
    ] as Line),
    [''],
    [seg('🌱 가장 활발한 작성자', C.warn)],
    ...topA.map(([name, n]) => [
      '  ',
      seg(String(n).padStart(3), C.accent),
      '  ',
      seg(name, C.author),
    ] as Line),
  ];
  return { lines };
}

function collectAllRestaurants(node: Node): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  function walk(n: Node) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      out.push({ id: n.restaurant.id, name: n.restaurant.name });
      return;
    }
    for (const c of n.entries.values()) walk(c);
  }
  walk(node);
  return out;
}

// ---------------- grep ----------------

function runGrep(args: string[], ctx: CommandContext): CommandResult {
  const flags = new Set<string>();
  const positional: string[] = [];
  for (const a of args) {
    if (a.startsWith('--')) continue; // long flag (--color 등) 무시
    if (a.startsWith('-')) {
      for (const c of a.slice(1)) flags.add(c);
    } else {
      positional.push(a);
    }
  }
  const rawPattern = positional[0];
  let pathArg: string | undefined = positional[1];
  // shell glob '*' 같은 인자는 현재 디렉토리로 간주 (사용자 습관)
  if (pathArg === '*' || pathArg?.startsWith('*')) pathArg = undefined;
  if (!rawPattern) {
    return errLine('grep: pattern 필요  (예: grep "사장님" /)');
  }
  const pattern = rawPattern.replace(/^["']|["']$/g, ''); // 따옴표 제거
  const caseInsensitive = flags.has('i');
  const needle = caseInsensitive ? pattern.toLowerCase() : pattern;

  const startParts = pathArg ? resolvePath(ctx.cwd, pathArg) : ctx.cwd;
  const startNode = lookup(ctx.root, startParts);
  if (!startNode) return errLine(`grep: ${pathArg ?? formatPath(startParts)}: 경로 없음`);

  const matches: Line[] = [];
  const includes = (hay: string) =>
    (caseInsensitive ? hay.toLowerCase() : hay).includes(needle);

  function walk(node: Node, parts: string[]) {
    if (node.type === 'file') {
      const fp = formatPath(parts);
      node.content.split('\n').forEach((line, i) => {
        if (includes(line)) {
          matches.push([
            seg(fp, C.dir),
            seg(`:${i + 1}: `, C.dim),
            line,
          ]);
        }
      });
      return;
    }
    if (node.restaurant) {
      const rid = node.restaurant.id;
      const commits = ctx.reviews.filter(
        (rv) => rv.restaurant_id === rid && rv.parent_review_id === null,
      );
      for (const rv of commits) {
        if (includes(rv.message)) {
          const fp = formatPath(parts);
          const msg = rv.message.replace(/\n/g, ' ').slice(0, 100);
          matches.push([
            seg(fp, C.dir),
            seg(':', C.dim),
            seg(rv.hash, C.hash),
            ' ',
            seg(rv.author_name ?? '?', C.author),
            ': ',
            msg,
          ]);
        }
      }
    }
    for (const [name, child] of node.entries) walk(child, [...parts, name]);
  }
  walk(startNode, startParts);
  if (matches.length === 0) return { lines: [[seg('(매치 없음)', C.dim)]] };
  if (matches.length > 200) {
    matches.length = 200;
    matches.push([seg('... (200개 초과)', C.dim)]);
  }
  return { lines: matches };
}

// ---------------- find ----------------

function runFind(args: string[], ctx: CommandContext): CommandResult {
  // 단순 syntax: find <pattern>  또는 find -name <pattern>
  // shell 습관 지원: 양쪽 따옴표 / 와일드카드 * 는 substring 매칭으로 무시
  const positional = args.filter((a) => !a.startsWith('-') && a !== 'name');
  const raw = positional[0];
  if (!raw) {
    return errLine('find: 패턴 필요  (예: find 닭갈비  또는  find "*닭갈비*")');
  }
  // 따옴표 + 양쪽 * 제거 (shell glob 흉내)
  const pattern = raw.replace(/^["']|["']$/g, '').replace(/^\*+|\*+$/g, '');
  if (!pattern) return errLine('find: 빈 패턴');
  const needle = pattern.toLowerCase();
  const matches: Line[] = [];

  function walk(node: Node, parts: string[]) {
    if (node.type !== 'dir') return;
    if (node.restaurant && node.name.toLowerCase().includes(needle)) {
      matches.push([
        seg(formatPath(parts), C.dir),
        seg(`  (commit ${node.restaurant.commit_count})`, C.dim),
      ]);
    }
    for (const [name, child] of node.entries) walk(child, [...parts, name]);
  }
  walk(ctx.root, []);
  if (matches.length === 0) return { lines: [[seg('(매치 없음)', C.dim)]] };
  return { lines: matches };
}

// ---------------- whoami / date / history ----------------

function runDate(): Segment {
  // KST = UTC+9
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const iso = kst.toISOString().slice(0, 19).replace('T', ' ');
  return seg(`${iso} KST`, C.date);
}

function runHistory(ctx: CommandContext): CommandResult {
  if (ctx.cmdHistory.length === 0) return { lines: [[seg('(기록 없음)', C.dim)]] };
  return {
    lines: ctx.cmdHistory.map((h, i) => [
      seg(String(i + 1).padStart(4), C.dim),
      '  ',
      h,
    ]),
  };
}

// ---------------- cowsay ----------------

function runCowsay(msg: string): CommandResult {
  const text = (msg || 'Moo').slice(0, 60);
  const width = text.length + 2;
  const top = ` ${'_'.repeat(width)}`;
  const bot = ` ${'-'.repeat(width)}`;
  const lines: Line[] = [
    [seg(top, C.warn)],
    [seg(`< ${text} >`, C.accent)],
    [seg(bot, C.warn)],
    [seg('        \\   ^__^', C.warn)],
    [seg('         \\  (oo)\\_______', C.warn)],
    [seg('            (__)\\       )\\/\\', C.warn)],
    [seg('                ||----w |', C.warn)],
    [seg('                ||     ||', C.warn)],
  ];
  return { lines };
}

// ---------------- helpers ----------------

function errLine(msg: string): CommandResult {
  return { lines: [[seg(msg, C.error)]] };
}

// Segment re-export for callers
import type { Segment } from './colors';
export type { Segment };
