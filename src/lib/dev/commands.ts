// D82: 개발자 모드 — 명령어 파서 + 실행기.
// 출력은 Line[] = Segment[][] 로 색깔 segment 지원.

import {
  formatPath,
  lookup,
  resolvePath,
  type DevRestaurant,
  type DevReview,
  type DirNode,
  type Node,
} from './fs';
import { C, seg, type Line, type Segment } from './colors';
import { BADGE_BY_CODE } from '@/lib/badges';
import { createReview } from '@/lib/reviews/actions';
import { generateCommitHash } from '@/lib/hash';

export interface CommandContext {
  root: DirNode;
  cwd: string[];
  reviews: DevReview[]; // 전체 리뷰
  prEvents: DevPREvent[]; // PR 이벤트 (git log 에 interleave)
  badgesByUser: Record<string, string[]>; // 닉네임 → badge code 들
  crownsByUser: Record<string, string[]>; // 닉네임 → office 이름 들
  cmdHistory: string[]; // history 명령용
  currentUserName: string; // whoami 용
  originLat: number; // 본인 사옥/임시 위치 — near 명령용
  originLng: number;
  startedAt: number; // uptime 용 (epoch ms)
  setCwd: (parts: string[]) => void;
  clear: () => void;
  setTheme: (t: Theme) => void;
}

export interface DevPREvent {
  pr_id: string;
  pr_kind: 'merge' | 'edit';
  event: 'open' | 'merged' | 'closed';
  source_name: string;
  target_name: string;
  target_id: string | null;
  actor_name: string | null;
  edit_field: string | null;
  at: string;
}

export type Theme = 'matrix' | 'amber' | 'classic';

export interface CommandResult {
  lines: Line[];
}

const HELP: Line[] = [
  ['📂 navigation'],
  ['  pwd / ls [-al] [path] / cd <path> / cat <file> / tree [path] [-L N]'],
  [''],
  ['📜 git'],
  ['  git log [path] / git show <hash> / git contributors [path] / git stats'],
  ['  git branch / git checkout <lunch|dinner>'],
  [''],
  ['🔍 search'],
  ['  grep <pat> [path] [-i] / find <pattern>'],
  [''],
  ['🍱 lunchlog'],
  ['  finger <닉네임> / myself / random [cuisine] / near [km] / trending / leaderboard'],
  [''],
  ['🛠 unix'],
  ['  wc <file> / head [-n N] <file> / tail [-n N] <file> / echo / uname / uptime / env'],
  [''],
  ['🎨 fun'],
  ['  cowsay <msg> / fortune / lolcat <msg> / theme <matrix|amber|classic>'],
  [''],
  ['ℹ️'],
  ['  whoami / date / history / clear (Ctrl+L) / help'],
  [''],
  ['구조: /<사옥>/<점심|저녁>/<cuisine>/<식당>/<file>'],
];

export async function runCommand(input: string, ctx: CommandContext): Promise<CommandResult> {
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
    case 'tree':
      return runTree(rest, ctx);
    case 'wc':
      return runWc(rest[0], ctx);
    case 'head':
      return runHeadTail(rest, ctx, 'head');
    case 'tail':
      return runHeadTail(rest, ctx, 'tail');
    case 'echo':
      return { lines: [[rest.join(' ')]] };
    case 'uname':
      return runUname(rest);
    case 'uptime':
      return runUptime(ctx);
    case 'env':
      return runEnv(ctx);
    case 'finger':
      return runFinger(rest[0], ctx);
    case 'myself':
      return runFinger(ctx.currentUserName, ctx);
    case 'random':
      return runRandom(rest[0], ctx);
    case 'near':
      return runNear(rest[0], ctx);
    case 'trending':
      return runTrending(ctx);
    case 'leaderboard':
      return runLeaderboard(ctx);
    case 'fortune':
      return runFortune();
    case 'lolcat':
      return runLolcat(rest.join(' '));
    case 'theme':
      return runTheme(rest[0], ctx);
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

  // Korean 은 monospace 에서 2칸 차지 — 정렬용
  const displayWidth = (s: string) =>
    Array.from(s).reduce((w, ch) => w + (ch.charCodeAt(0) > 0x7f ? 2 : 1), 0);

  if (longFormat) {
    // Unix-style: perms  links  owner  group  size  date  name
    const owner = 'user';
    const group = 'lunchlog';
    const rows = entries.map((e) => {
      const isHidden = e.name.startsWith('.');
      const isDir = e.type === 'dir';
      const perms = isDir
        ? 'drwxr-xr-x'
        : isHidden
          ? '-rw-------'
          : '-rw-r--r--';
      const links = isDir ? (e.entries.size + 2) : 1;
      const size = isDir
        ? 4096
        : e.content.length;
      // restaurant 면 last_commit_at, 아니면 N/A (fixed)
      let dateStr = '         -';
      if (isDir && e.restaurant?.last_commit_at) {
        dateStr = formatLsDate(e.restaurant.last_commit_at);
      }
      const displayName = isDir ? e.name + '/' : e.name;
      const nameCls = isDir ? C.dir : isHidden ? C.hidden : '';
      return { perms, links, size, dateStr, displayName, nameCls };
    });
    // 정렬 폭 계산
    const maxLinks = Math.max(...rows.map((r) => String(r.links).length), 1);
    const maxSize = Math.max(...rows.map((r) => String(r.size).length), 1);
    return {
      lines: rows.map((r) => [
        seg(r.perms, C.dim),
        '  ',
        seg(String(r.links).padStart(maxLinks), C.dim),
        ' ',
        seg(owner, C.author),
        ' ',
        seg(group, C.dim),
        '  ',
        seg(String(r.size).padStart(maxSize), C.accent),
        '  ',
        seg(r.dateStr, C.date),
        '  ',
        seg(r.displayName, r.nameCls),
      ]),
    };
  }

  // 기본 ls: 컬럼 그리드 (4컬럼 기본)
  const COLS = 4;
  const formatted = entries.map((e) => {
    const isHidden = e.name.startsWith('.');
    const isDir = e.type === 'dir';
    const displayName = isDir ? e.name + '/' : e.name;
    const cls = isDir ? C.dir : isHidden ? C.hidden : '';
    return { displayName, cls };
  });
  const colWidth = Math.max(...formatted.map((f) => displayWidth(f.displayName)), 8) + 3;
  const lines: Line[] = [];
  for (let i = 0; i < formatted.length; i += COLS) {
    const chunk = formatted.slice(i, i + COLS);
    const segs: Line = [];
    chunk.forEach((f, j) => {
      segs.push(seg(f.displayName, f.cls));
      if (j < chunk.length - 1) {
        const pad = colWidth - displayWidth(f.displayName);
        segs.push(' '.repeat(Math.max(1, pad)));
      }
    });
    lines.push(segs);
  }
  return { lines };
}

function formatLsDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '         -';
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getUTCMonth()] ?? '?';
  const day = String(d.getUTCDate()).padStart(2, ' ');
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  if (sameYear) {
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    return `${month} ${day} ${h}:${m}`;
  }
  return `${month} ${day}  ${d.getUTCFullYear()}`;
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

function runGit(args: string[], ctx: CommandContext): CommandResult | Promise<CommandResult> {
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
    case 'branch':
      return runGitBranch(ctx);
    case 'checkout':
      return runGitCheckout(args[1], ctx);
    case 'commit':
      return runGitCommit(args.slice(1), ctx);
    case 'init':
      return errLine('git init: 식당 등록은 + 새 맛집 (헤더) — 카카오 검색이 필요');
    default:
      return errLine(
        `git: '${sub ?? ''}' 명령 미지원. log/show/contributors/stats/branch/checkout/commit`,
      );
  }
}

async function runGitCommit(args: string[], ctx: CommandContext): Promise<CommandResult> {
  const node = lookup(ctx.root, ctx.cwd);
  const restaurant = node && node.type === 'dir' ? node.restaurant : null;
  if (!restaurant) {
    return errLine('git commit: 식당 디렉토리에서 실행 (예: cd /광화문/점심/한식/계시)');
  }
  const mealSeg = ctx.cwd[1];
  if (mealSeg !== '점심' && mealSeg !== '저녁') {
    return errLine('git commit: 경로에 점심/저녁 segment 필요');
  }
  // -m 뒤 전부 메시지 (앞뒤 따옴표 제거)
  const mIdx = args.indexOf('-m');
  if (mIdx === -1 || mIdx === args.length - 1) {
    return errLine('git commit: -m "메시지" 필요');
  }
  const message = args
    .slice(mIdx + 1)
    .join(' ')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!message) return errLine('git commit: 빈 메시지');

  const hash = generateCommitHash();
  const r = await createReview({
    restaurantId: restaurant.id,
    message,
    mealTime: mealSeg === '점심' ? 'lunch' : 'dinner',
    partySize: null,
    hash,
    parentReviewId: null,
  });
  if (!r.ok) return errLine(`git commit: ${r.message}`);
  return {
    lines: [
      [seg('✓ ', C.accent), seg(hash, C.hash), seg(' committed', C.dim)],
      [seg('  (refresh page to see in git log)', C.dim)],
    ],
  };
}

function runGitBranch(ctx: CommandContext): CommandResult {
  // 현재 cwd 에 점심/저녁 있으면 마킹
  const currentMeal = ctx.cwd.find((p) => p === '점심' || p === '저녁');
  const branches = ['점심', '저녁', '🚀 main'];
  return {
    lines: branches.map((b) => {
      const isCurrent = b === currentMeal;
      return [
        isCurrent ? seg('* ', C.accent) : '  ',
        isCurrent ? seg(b, C.accent) : seg(b, C.dim),
      ];
    }),
  };
}

function runGitCheckout(name: string | undefined, ctx: CommandContext): CommandResult {
  if (!name) return errLine('git checkout: branch 이름 필요 (점심 / 저녁)');
  const target = name === 'lunch' ? '점심' : name === 'dinner' ? '저녁' : name;
  if (target !== '점심' && target !== '저녁') {
    return errLine(`git checkout: ${name}: 미지원 branch (점심 / 저녁만)`);
  }
  if (ctx.cwd.length === 0) {
    return errLine('git checkout: 사옥 먼저 선택하세요 (예: cd /광화문)');
  }
  // 사옥은 유지, 두번째 슬롯을 target meal 로
  const newCwd: string[] = [ctx.cwd[0]!, target];
  // 이후 cuisine/식당 부분이 새 mode 에 존재하면 유지
  const rest = ctx.cwd.slice(2);
  let cur: string[] = newCwd;
  for (const p of rest) {
    const tentative = [...cur, p];
    if (lookup(ctx.root, tentative)) cur = tentative;
    else break;
  }
  const node = lookup(ctx.root, cur);
  if (!node) {
    return errLine(
      `git checkout: ${formatPath(cur)}: 경로 없음 (이 사옥에 ${target} 식당이 없음)`,
    );
  }
  ctx.setCwd(cur);
  return { lines: [[seg(`Switched to branch '${target}' (${formatPath(cur)})`, C.accent)]] };
}

function runGitLog(args: string[], ctx: CommandContext): CommandResult {
  // 실제 git log 처럼 한 페이지 (~20) 만 보여줌. --all 또는 -a 로 전체.
  const showAll = args.includes('--all') || args.includes('-a');
  const positional = args.filter((a) => !a.startsWith('-'));
  const target = positional.length >= 1 ? resolvePath(ctx.cwd, positional[0]!) : ctx.cwd;
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

  const commits = ctx.reviews.filter(
    (rv) => restaurantIds.has(rv.restaurant_id) && rv.parent_review_id === null,
  );
  const prs = ctx.prEvents.filter(
    (p) => p.target_id !== null && restaurantIds.has(p.target_id),
  );

  if (commits.length === 0 && prs.length === 0) {
    return { lines: [[seg('(아직 commit 없음)', C.dim)]] };
  }

  // 시간순 통합 (review.created_at vs pr.at)
  type Entry = { at: string; kind: 'commit'; rv: DevReview } | { at: string; kind: 'pr'; pr: DevPREvent };
  const entries: Entry[] = [
    ...commits.map((rv) => ({ at: rv.created_at, kind: 'commit' as const, rv })),
    ...prs.map((pr) => ({ at: pr.at, kind: 'pr' as const, pr })),
  ];
  entries.sort((a, b) => (a.at > b.at ? -1 : 1));

  const LIMIT = 20;
  const shown = showAll ? entries : entries.slice(0, LIMIT);
  const lines: Line[] = shown.map((e) =>
    e.kind === 'commit'
      ? commitLogLine(e.rv, showRestaurantName ? (nameById.get(e.rv.restaurant_id) ?? null) : null)
      : prLogLine(e.pr, showRestaurantName),
  );
  if (!showAll && entries.length > LIMIT) {
    lines.push([
      seg(`... ${entries.length - LIMIT} more entries  `, C.dim),
      seg('(use --all)', C.warn),
    ]);
  }
  return { lines };
}

function prLogLine(p: DevPREvent, showName: boolean): Line {
  const dateStr = p.at.slice(0, 10);
  const icon = p.event === 'open' ? '🔀' : p.event === 'merged' ? '✅' : '🚫';
  const eventCls =
    p.event === 'open' ? C.warn : p.event === 'merged' ? C.accent : C.error;
  const label =
    p.event === 'open'
      ? p.pr_kind === 'edit'
        ? `PR open (edit:${p.edit_field ?? '?'})`
        : 'PR open (merge)'
      : p.event === 'merged'
        ? p.pr_kind === 'edit'
          ? 'PR applied'
          : 'PR merged'
        : 'PR closed';
  const actor = p.actor_name ?? '?';
  const restaurantTag = showName ? ` [${p.target_name}]` : '';
  const detail = p.pr_kind === 'merge' && p.event === 'open' ? ` ${p.source_name} → ${p.target_name}` : '';
  return [
    `${icon} `,
    seg(dateStr, C.date),
    ' ',
    seg(label, eventCls),
    '  ',
    seg(actor, C.author),
    `${restaurantTag}${detail}`,
  ];
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
    const r = n.restaurant;
    if (r && r.id === restaurantId) {
      restaurantName = r.name;
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

// ---------------- tree ----------------

function runTree(args: string[], ctx: CommandContext): CommandResult {
  const flags = new Set<string>();
  const positional: string[] = [];
  let maxDepth = 2; // 기본 2단계
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === undefined) continue;
    if (a === '-L' && args[i + 1]) {
      maxDepth = parseInt(args[i + 1]!, 10);
      i++;
    } else if (a.startsWith('-')) {
      for (const c of a.slice(1)) flags.add(c);
    } else {
      positional.push(a);
    }
  }
  const startParts = positional[0] ? resolvePath(ctx.cwd, positional[0]) : ctx.cwd;
  const startNode = lookup(ctx.root, startParts);
  if (!startNode || startNode.type !== 'dir') {
    return errLine(`tree: ${positional[0] ?? formatPath(startParts)}: 디렉토리 없음`);
  }
  const lines: Line[] = [[seg(formatPath(startParts), C.dir)]];
  let dirCount = 0;
  let fileCount = 0;

  function walk(node: Node, prefix: string, depth: number) {
    if (depth > maxDepth) return;
    if (node.type !== 'dir') return;
    const entries = Array.from(node.entries.values())
      .filter((e) => !e.name.startsWith('.'))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
    entries.forEach((e, i) => {
      const isLast = i === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      if (e.type === 'dir') {
        dirCount++;
        lines.push([seg(prefix + connector, C.dim), seg(e.name + '/', C.dir)]);
        walk(e, prefix + (isLast ? '    ' : '│   '), depth + 1);
      } else {
        fileCount++;
        lines.push([seg(prefix + connector, C.dim), e.name]);
      }
    });
  }
  walk(startNode, '', 1);
  lines.push(['']);
  lines.push([seg(`${dirCount} directories, ${fileCount} files`, C.dim)]);
  return { lines };
}

// ---------------- wc / head / tail ----------------

function runWc(path: string | undefined, ctx: CommandContext): CommandResult {
  if (!path) return errLine('wc: 파일 이름 필요');
  const node = lookup(ctx.root, resolvePath(ctx.cwd, path));
  if (!node) return errLine(`wc: ${path}: 없음`);
  if (node.type !== 'file') return errLine(`wc: ${path}: 디렉토리`);
  const content = node.content;
  const lines = content.split('\n').length;
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const chars = content.length;
  return {
    lines: [[
      seg(String(lines).padStart(4), C.accent),
      ' ',
      seg(String(words).padStart(4), C.accent),
      ' ',
      seg(String(chars).padStart(6), C.accent),
      seg(`  ${path}`, C.dir),
    ]],
  };
}

function runHeadTail(args: string[], ctx: CommandContext, mode: 'head' | 'tail'): CommandResult {
  let n = 10;
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-n' && args[i + 1]) {
      n = parseInt(args[i + 1]!, 10) || 10;
      i++;
    } else if (a !== undefined) {
      positional.push(a);
    }
  }
  const path = positional[0];
  if (!path) return errLine(`${mode}: 파일 이름 필요`);
  const node = lookup(ctx.root, resolvePath(ctx.cwd, path));
  if (!node) return errLine(`${mode}: ${path}: 없음`);
  if (node.type !== 'file') return errLine(`${mode}: ${path}: 디렉토리`);
  const all = node.content.split('\n');
  const picked = mode === 'head' ? all.slice(0, n) : all.slice(-n);
  return { lines: picked.map((l) => [l] as Line) };
}

// ---------------- uname / uptime / env ----------------

function runUname(args: string[]): CommandResult {
  if (args.includes('-a')) {
    return {
      lines: [[
        seg('lunchlog', C.accent),
        ' ',
        seg('0.2-dev', C.dim),
        ' ',
        seg('CommitOS', C.warn),
        ' (built with 🍱 + ☕)',
      ]],
    };
  }
  return { lines: [[seg('CommitOS', C.accent)]] };
}

function runUptime(ctx: CommandContext): CommandResult {
  const diff = Date.now() - ctx.startedAt;
  const m = Math.floor(diff / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const since = m > 0 ? `${m}m ${s}s` : `${s}s`;
  return { lines: [[seg(`up ${since}`, C.dim)]] };
}

function runEnv(ctx: CommandContext): CommandResult {
  return {
    lines: [
      [seg('USER=', C.dim), seg(ctx.currentUserName, C.author)],
      [seg('PWD=', C.dim), seg(formatPath(ctx.cwd), C.prompt_path)],
      [seg('SHELL=', C.dim), seg('/bin/lunchlog', C.accent)],
      [seg('LANG=', C.dim), 'ko_KR.UTF-8'],
      [seg('TZ=', C.dim), 'Asia/Seoul'],
      [seg('CRAVING=', C.dim), seg('점심', C.warn)],
    ],
  };
}

// ---------------- finger / myself ----------------

function runFinger(name: string | undefined, ctx: CommandContext): CommandResult {
  if (!name) return errLine('finger: 닉네임 필요');
  // 그 사용자의 commit 통계
  const myCommits = ctx.reviews.filter(
    (rv) => rv.author_name === name && !rv.reverted && rv.parent_review_id === null,
  );
  if (myCommits.length === 0 && name !== ctx.currentUserName) {
    return errLine(`finger: ${name}: 활동 기록 없음`);
  }
  // cuisine 분포 (식당 lookup 필요)
  const restById = new Map<string, { name: string; cuisine_types: string[] }>();
  function walk(n: Node) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      restById.set(n.restaurant.id, {
        name: n.restaurant.name,
        cuisine_types: n.restaurant.cuisine_types,
      });
      return;
    }
    for (const c of n.entries.values()) walk(c);
  }
  walk(ctx.root);

  const cuisineCount = new Map<string, number>();
  for (const rv of myCommits) {
    const r = restById.get(rv.restaurant_id);
    if (!r) continue;
    const top = r.cuisine_types[0];
    if (top) cuisineCount.set(top, (cuisineCount.get(top) ?? 0) + 1);
  }
  const topCuisines = Array.from(cuisineCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c, n]) => `${c} ${n}`)
    .join(' / ');

  // 등록한 식당
  const registered: string[] = [];
  function walkR(n: Node) {
    if (n.type !== 'dir') return;
    const r = n.restaurant;
    if (r && r.creator_name === name) registered.push(r.name);
    else for (const c of n.entries.values()) walkR(c);
  }
  walkR(ctx.root);

  const lastCommit = myCommits[0];
  const badgeCodes = ctx.badgesByUser[name] ?? [];
  const crowns = ctx.crownsByUser[name] ?? [];

  const lines: Line[] = [
    [seg('User:        ', C.dim), seg(name, C.author)],
    [seg('Commits:     ', C.dim), seg(String(myCommits.length), C.accent)],
    [seg('Top cuisine: ', C.dim), topCuisines || '(없음)'],
    [
      seg('Last:        ', C.dim),
      lastCommit ? seg(lastCommit.created_at.slice(0, 10), C.date) : '(없음)',
    ],
    [
      seg('Registered:  ', C.dim),
      seg(String(registered.length) + ' 곳', C.accent),
      registered.length > 0
        ? `  (${registered.slice(0, 3).join(', ')}${registered.length > 3 ? '...' : ''})`
        : '',
    ],
  ];

  if (crowns.length > 0) {
    lines.push([
      seg('Crowns:      ', C.dim),
      seg(crowns.map((o) => `👑 ${o} 대장`).join(' / '), C.warn),
    ]);
  }

  if (badgeCodes.length > 0) {
    const metas = badgeCodes
      .map((c) => BADGE_BY_CODE.get(c))
      .filter((m): m is NonNullable<typeof m> => !!m);
    const emojis = metas.map((m) => m.emoji).join(' ');
    const labels = metas.map((m) => m.label).join(' / ');
    lines.push([
      seg('Badges:      ', C.dim),
      seg(`${emojis}  `, C.accent),
      seg(`(${metas.length}) `, C.dim),
      seg(labels, C.dim),
    ]);
  }

  return { lines };
}

// ---------------- random / near / trending / leaderboard ----------------

function runRandom(cuisineArg: string | undefined, ctx: CommandContext): CommandResult {
  const all: { name: string; path: string[]; data: DevRestaurant }[] = [];
  function walk(n: Node, path: string[]) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      all.push({ name: n.name, path, data: n.restaurant });
      return;
    }
    for (const [k, c] of n.entries) walk(c, [...path, k]);
  }
  walk(ctx.root, []);
  let pool = all;
  if (cuisineArg) {
    const needle = cuisineArg.toLowerCase();
    pool = all.filter((r) =>
      r.data.cuisine_types.some((c) => c.toLowerCase().includes(needle)),
    );
  }
  if (pool.length === 0) return errLine('random: 매치 식당 없음');
  const idx = Math.floor((Date.now() % 1000) / 1000 * pool.length) % pool.length;
  const pick = pool[idx]!;
  return {
    lines: [
      [seg('🎲 오늘은 ', C.dim), seg(pick.data.name, C.accent), seg('!', C.warn)],
      [
        seg('  cuisine: ', C.dim),
        seg(pick.data.cuisine_types.join(' / '), C.dir),
      ],
      [
        seg('  path:    ', C.dim),
        seg(formatPath(pick.path), C.prompt_path),
      ],
      [seg('  commit:  ', C.dim), seg(String(pick.data.commit_count), C.accent)],
    ],
  };
}

function runNear(distArg: string | undefined, ctx: CommandContext): CommandResult {
  // 미터 단위 입력 (기본 500m)
  const maxM = distArg ? parseFloat(distArg) : 500;
  if (!isFinite(maxM) || maxM <= 0) return errLine('near: 거리(m) 가 양수여야 함');
  const maxKm = maxM / 1000;
  const all: { dist: number; name: string; path: string[]; cuisine: string }[] = [];
  function walk(n: Node, path: string[]) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      const r = n.restaurant;
      // planar km approx
      const dLat = (r.latitude - ctx.originLat) * 111;
      const dLng = (r.longitude - ctx.originLng) * 88.6;
      const km = Math.sqrt(dLat * dLat + dLng * dLng);
      if (km <= maxKm) {
        all.push({
          dist: km,
          name: r.name,
          path,
          cuisine: r.cuisine_types[0] ?? '',
        });
      }
      return;
    }
    for (const [k, c] of n.entries) walk(c, [...path, k]);
  }
  walk(ctx.root, []);
  if (all.length === 0) return errLine(`near: ${maxM}m 내 식당 없음`);
  all.sort((a, b) => a.dist - b.dist);
  return {
    lines: all.slice(0, 20).map((r) => [
      seg((r.dist * 1000).toFixed(0).padStart(5) + 'm', C.dim),
      '  ',
      seg(r.cuisine.padEnd(8), C.dir),
      seg(r.name, ''),
    ]),
  };
}

function runTrending(ctx: CommandContext): CommandResult {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = ctx.reviews.filter(
    (rv) =>
      !rv.reverted &&
      rv.parent_review_id === null &&
      new Date(rv.created_at).getTime() > cutoff,
  );
  const byRestaurant = new Map<string, number>();
  for (const rv of recent) {
    byRestaurant.set(rv.restaurant_id, (byRestaurant.get(rv.restaurant_id) ?? 0) + 1);
  }
  if (byRestaurant.size === 0) return { lines: [[seg('(최근 7일 commit 없음)', C.dim)]] };
  const nameById = new Map<string, string>();
  function walk(n: Node) {
    if (n.type !== 'dir') return;
    if (n.restaurant) {
      nameById.set(n.restaurant.id, n.restaurant.name);
      return;
    }
    for (const c of n.entries.values()) walk(c);
  }
  walk(ctx.root);
  const sorted = Array.from(byRestaurant.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  return {
    lines: [
      [seg('🔥 최근 7일 trending', C.warn)],
      ...sorted.map(([id, n]) => [
        seg(`  ${String(n).padStart(3)}`, C.accent),
        '  ',
        seg(nameById.get(id) ?? '?', C.dir),
      ] as Line),
    ],
  };
}

function runLeaderboard(ctx: CommandContext): CommandResult {
  const byAuthor = new Map<string, number>();
  for (const rv of ctx.reviews) {
    if (rv.reverted || rv.parent_review_id) continue;
    const name = rv.author_name ?? '?';
    byAuthor.set(name, (byAuthor.get(name) ?? 0) + 1);
  }
  if (byAuthor.size === 0) return { lines: [[seg('(commit 없음)', C.dim)]] };
  const sorted = Array.from(byAuthor.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxN = sorted[0]![1];
  return {
    lines: [
      [seg('🏆 leaderboard', C.warn)],
      ...sorted.map(([name, n], i) => {
        const barLen = Math.max(1, Math.round((n / maxN) * 20));
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        return [
          `${medal} `,
          seg(name.padEnd(14), C.author),
          seg(String(n).padStart(4), C.accent),
          '  ',
          seg('█'.repeat(barLen), C.hash),
        ] as Line;
      }),
    ],
  };
}

// ---------------- fortune / lolcat ----------------

const FORTUNES = [
  '오늘은 새 cuisine 도전하기 좋은 날',
  '회식은 도파민이 있어야 한다 — 사장님 친절도 체크',
  '점심은 신중히, 야근은 가볍게',
  '같은 메뉴 3일 연속? 잔디는 깔리지만 영혼이 마릅니다',
  '오래된 commit 도 다시 가보면 좋더라',
  '맛있으면 ❤️ 한 번 — 미래의 너에게 선물',
  '근처 안 가본 식당, 한 번쯤은 무모하게',
  '한식이 답일 때가 있다',
  '메뉴 고민? @동료 한테 PR 열어보세요',
  '오늘 commit 한 식당이 내일의 추억',
  '계란이 들어가면 일단 옳다',
  '비 오는 날엔 면이지',
];

function runFortune(): CommandResult {
  const f = FORTUNES[Math.floor(Math.random() * FORTUNES.length)] ?? FORTUNES[0]!;
  return { lines: [[seg('🥠 ', C.warn), seg(f, C.accent)]] };
}

function runLolcat(msg: string): CommandResult {
  const text = msg || 'lunchlog';
  const rainbow = ['text-red-400', 'text-amber-400', 'text-yellow-300', 'text-emerald-400', 'text-sky-400', 'text-violet-400'];
  const segs: Line = Array.from(text).map((ch, i) => seg(ch, rainbow[i % rainbow.length]!));
  return { lines: [segs] };
}

// ---------------- theme ----------------

function runTheme(name: string | undefined, ctx: CommandContext): CommandResult {
  if (!name) {
    return {
      lines: [
        [seg('사용 가능: ', C.dim), seg('matrix / amber / classic', C.accent)],
      ],
    };
  }
  if (name !== 'matrix' && name !== 'amber' && name !== 'classic') {
    return errLine(`theme: ${name}: 미지원 (matrix / amber / classic)`);
  }
  ctx.setTheme(name);
  return { lines: [[seg(`theme: ${name}`, C.accent)]] };
}

export type { Segment };
