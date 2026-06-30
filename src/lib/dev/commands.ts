// D82: 개발자 모드 — 명령어 파서 + 실행기.
// MVP: pwd, cd, ls, cat, git log, clear, help

import {
  formatPath,
  lookup,
  resolvePath,
  type DevReview,
  type DirNode,
} from './fs';

export interface CommandContext {
  root: DirNode;
  cwd: string[]; // ['광화문', 'lunch', '한식', '계시']
  reviews: DevReview[]; // 전체 리뷰 (git log 용)
  setCwd: (parts: string[]) => void;
  clear: () => void;
}

export interface CommandResult {
  // 출력 라인들. 빈 배열이면 출력 없음.
  lines: string[];
}

const HELP = [
  '명령어:',
  '  pwd                  현재 경로',
  '  ls [path]            디렉토리 / 파일 목록',
  '  cd <path>            디렉토리 이동 (.., /, 절대/상대 OK)',
  '  cat <file>           파일 내용',
  '  git log [restaurant] commit 목록 (식당 안이면 인자 생략)',
  '  clear                화면 지우기',
  '  help                 이 도움말',
  '',
  '구조: /<office>/<meal>/<cuisine>/<restaurant>/<file>',
  '예: cd /광화문/lunch/한식/계시 → ls → cat README.md → git log',
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
      return { lines: [formatPath(ctx.cwd)] };

    case 'ls':
      return runLs(rest[0], ctx);

    case 'cd':
      return runCd(rest[0], ctx);

    case 'cat':
      return runCat(rest[0], ctx);

    case 'git':
      return runGit(rest, ctx);

    default:
      return { lines: [`command not found: ${cmd}`, '"help" 로 사용 가능 명령어 확인`'] };
  }
}

function runLs(path: string | undefined, ctx: CommandContext): CommandResult {
  const parts = path ? resolvePath(ctx.cwd, path) : ctx.cwd;
  const node = lookup(ctx.root, parts);
  if (!node) return { lines: [`ls: ${path ?? formatPath(parts)}: 경로 없음`] };
  if (node.type !== 'dir') return { lines: [node.name] };

  const lines: string[] = [];
  const entries = Array.from(node.entries.values());
  // dir 먼저, file 나중 — 한글 정렬
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name, 'ko');
  });
  for (const e of entries) {
    if (e.type === 'dir') {
      const meta = e.restaurant
        ? `  (commit ${e.restaurant.commit_count})`
        : '';
      lines.push(`${e.name}/${meta}`);
    } else {
      lines.push(e.name);
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
  if (!node) return { lines: [`cd: ${path}: 경로 없음`] };
  if (node.type !== 'dir') return { lines: [`cd: ${path}: 디렉토리 아님`] };
  ctx.setCwd(parts);
  return { lines: [] };
}

function runCat(path: string | undefined, ctx: CommandContext): CommandResult {
  if (!path) return { lines: ['cat: 파일 이름 필요'] };
  const parts = resolvePath(ctx.cwd, path);
  const node = lookup(ctx.root, parts);
  if (!node) return { lines: [`cat: ${path}: 없음`] };
  if (node.type !== 'file') return { lines: [`cat: ${path}: 디렉토리`] };
  return { lines: node.content.split('\n') };
}

function runGit(args: string[], ctx: CommandContext): CommandResult {
  const sub = args[0];
  if (sub !== 'log') {
    return { lines: [`git: '${sub ?? ''}' 명령은 v2 에서 지원. 현재는 'git log' 만`] };
  }

  // cwd 또는 인자에서 식당 찾기
  let target: string[];
  if (args.length >= 2) {
    target = resolvePath(ctx.cwd, args[1]!);
  } else {
    target = ctx.cwd;
  }

  const node = lookup(ctx.root, target);
  if (!node || node.type !== 'dir' || !node.restaurant) {
    return {
      lines: [
        `git log: 식당 디렉토리에서 실행하거나 식당 경로 인자 필요`,
        `예: cd /광화문/lunch/한식/계시 && git log`,
      ],
    };
  }

  const restaurantId = node.restaurant.id;
  const rootReviews = ctx.reviews
    .filter((rv) => rv.restaurant_id === restaurantId && rv.parent_review_id === null)
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

  if (rootReviews.length === 0) {
    return { lines: ['(아직 commit 없음)'] };
  }

  const lines: string[] = [];
  for (const rv of rootReviews) {
    const dateStr = rv.created_at.slice(0, 10);
    const meal = rv.meal_time === 'lunch' ? '☀' : '🌙';
    const party = rv.party_size ? ` (${rv.party_size}명)` : '';
    const revertMark = rv.reverted ? ' [REVERTED]' : '';
    const author = rv.author_name ?? '?';
    const msg = rv.message.replace(/\n/g, ' ').slice(0, 80);
    lines.push(`${rv.hash} ${dateStr} ${meal} ${author}${party}${revertMark}: ${msg}`);
  }
  return { lines };
}
