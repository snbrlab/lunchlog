// D82: 개발자 모드 — 가상 파일시스템 빌더.
// 사옥/meal/cuisine/식당 트리. 식당 안엔 README.md / INFO / MENU / .kakao.

import type { Office } from '@/types/db';
import type { CuisineItem } from '@/lib/cuisine';

export interface DevRestaurant {
  id: string;
  name: string;
  cuisine_types: string[];
  categories: string[];
  price_level: 1 | 2 | 3;
  has_alcohol: boolean;
  address: string;
  latitude: number;
  longitude: number;
  kakao_place_url: string | null;
  office_id: string | null;
  commit_count: number;
  last_commit_at: string | null;
  created_at: string;
  creator_name: string | null;
  menu_tags: string[];
  is_closed: boolean;
}

export interface DevReview {
  id: string;
  restaurant_id: string;
  hash: string;
  message: string;
  meal_time: 'lunch' | 'dinner';
  party_size: number | null;
  reverted: boolean;
  parent_review_id: string | null;
  created_at: string;
  author_name: string | null;
}

export type Node = DirNode | FileNode;

export interface DirNode {
  type: 'dir';
  name: string;
  entries: Map<string, Node>;
  restaurant?: DevRestaurant; // 식당 디렉토리면 식당 metadata 보관 (git log 등 위해)
}

export interface FileNode {
  type: 'file';
  name: string;
  content: string;
}

function dir(name: string, restaurant?: DevRestaurant): DirNode {
  return { type: 'dir', name, entries: new Map(), restaurant };
}
function file(name: string, content: string): FileNode {
  return { type: 'file', name, content };
}

const MEAL_LABEL: Record<string, string> = { lunch: '점심', dinner: '저녁' };

export function buildVfs(
  restaurants: DevRestaurant[],
  offices: Office[],
  cuisineItems: CuisineItem[],
): DirNode {
  const root = dir('/');

  const officeName = (id: string | null) =>
    offices.find((o) => o.id === id)?.name ?? '미분류';

  const cuisineGroupLabel = (value: string): string =>
    cuisineItems.find((c) => c.value === value)?.group_label ?? '기타';

  for (const r of restaurants) {
    const offName = officeName(r.office_id);

    let officeDir = root.entries.get(offName) as DirNode | undefined;
    if (!officeDir) {
      officeDir = dir(offName);
      root.entries.set(offName, officeDir);
    }

    for (const cat of r.categories) {
      const mealName = MEAL_LABEL[cat] ?? cat;
      let mealDir = officeDir.entries.get(mealName) as DirNode | undefined;
      if (!mealDir) {
        mealDir = dir(mealName);
        officeDir.entries.set(mealName, mealDir);
      }

      // 식당의 첫 cuisine 의 group_label 기준으로 분류 (없으면 '기타')
      const primaryCuisine = r.cuisine_types[0] ?? '';
      const groupLabel = cuisineGroupLabel(primaryCuisine);
      let cuisineDir = mealDir.entries.get(groupLabel) as DirNode | undefined;
      if (!cuisineDir) {
        cuisineDir = dir(groupLabel);
        mealDir.entries.set(groupLabel, cuisineDir);
      }

      const restaurantDir = dir(r.name, r);
      restaurantDir.entries.set('README.md', file('README.md', renderReadme(r, offName)));
      restaurantDir.entries.set('INFO', file('INFO', renderInfo(r, offName)));
      restaurantDir.entries.set('MENU', file('MENU', renderMenu(r)));
      if (r.kakao_place_url) {
        restaurantDir.entries.set('.kakao', file('.kakao', r.kakao_place_url));
      }
      cuisineDir.entries.set(r.name, restaurantDir);
    }
  }

  return root;
}

function renderReadme(r: DevRestaurant, offName: string): string {
  const price = '₩'.repeat(r.price_level);
  const lines: string[] = [];
  lines.push(`# ${r.name}`);
  lines.push('');
  const cuisines = r.cuisine_types.join(' / ') || '미분류';
  lines.push(`${offName} · ${cuisines} · ${price}${r.has_alcohol ? ' · 🍺' : ''}`);
  lines.push('');
  if (r.address) lines.push(`📍 ${r.address}`);
  lines.push(`⭐ commit ${r.commit_count}개${r.last_commit_at ? ` · 최근 ${shortDate(r.last_commit_at)}` : ''}`);
  if (r.creator_name) lines.push(`🌱 ${r.creator_name} 가 처음 등록`);
  return lines.join('\n');
}

function renderInfo(r: DevRestaurant, offName: string): string {
  const lines: string[] = [];
  lines.push(`name=${r.name}`);
  lines.push(`cuisine_types=${r.cuisine_types.join(', ')}`);
  lines.push(`price_level=${r.price_level} (${'₩'.repeat(r.price_level)})`);
  lines.push(`categories=${r.categories.join(', ')}`);
  lines.push(`has_alcohol=${r.has_alcohol}`);
  lines.push(`location=${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`);
  lines.push(`office=${offName}`);
  lines.push(`registered_by=${r.creator_name ?? '?'}`);
  lines.push(`registered_at=${shortDate(r.created_at)}`);
  if (r.last_commit_at) lines.push(`last_commit_at=${shortDate(r.last_commit_at)}`);
  return lines.join('\n');
}

function renderMenu(r: DevRestaurant): string {
  if (r.menu_tags.length === 0) return '(none)';
  return r.menu_tags.join('\n');
}

function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

// path 파싱 — '/'/'.'/'..'/이름 처리
export function resolvePath(cwd: string[], input: string): string[] {
  const parts = input.startsWith('/') ? [] : [...cwd];
  for (const seg of input.split('/').filter(Boolean)) {
    if (seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts;
}

export function lookup(root: DirNode, parts: string[]): Node | null {
  let cur: Node = root;
  for (const seg of parts) {
    if (cur.type !== 'dir') return null;
    const next = cur.entries.get(seg);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

export function formatPath(parts: string[]): string {
  return '/' + parts.join('/');
}
