import { createSupabaseServerClient } from '@/lib/supabase/server';
import BuildingsEditor from './BuildingsEditor';
import type { OfficeBuilding } from '@/types/db';

export default async function AdminBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: buildings } = await supabase
    .from('office_buildings')
    .select('*')
    .order('display_order');

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">건물 좌표 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        시드의 임시 좌표를 카카오 검색 결과로 자동 보정하거나, 직접 lat/lng 입력 가능.
      </p>
      <BuildingsEditor buildings={(buildings ?? []) as OfficeBuilding[]} />
    </main>
  );
}
