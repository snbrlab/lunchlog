import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import CuisinesEditor from './CuisinesEditor';
import type { CuisineItem } from '@/lib/cuisine';

export default async function AdminCuisinesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') redirect('/map');

  // admin 페이지에선 캐시 우회 — 직접 fetch (수정 직후 stale 보이지 않게)
  const { data } = await supabase
    .from('cuisine_items')
    .select('value, label, emoji, group_label, display_order')
    .order('group_label')
    .order('display_order');

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">식당 카테고리 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        그룹은 고정 (한식/일식/...), 그 안의 음식 종류만 추가/수정 가능.
        <br />
        <span className="text-amber-700">
          ※ value 는 immutable (DB 저장 식별자). 변경하려면 삭제 후 새로 추가하세요. 단, 사용 중인 항목은 삭제 불가.
        </span>
      </p>
      <CuisinesEditor items={(data ?? []) as CuisineItem[]} />
    </main>
  );
}
