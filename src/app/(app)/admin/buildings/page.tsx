import { createSupabaseServerClient } from '@/lib/supabase/server';
import BuildingsEditor from './BuildingsEditor';
import type { Office, OfficeBuilding } from '@/types/db';

export default async function AdminBuildingsPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: offices }, { data: buildings }] = await Promise.all([
    supabase.from('offices').select('*').order('name'),
    supabase.from('office_buildings').select('*').order('display_order'),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">사무실 / 건물 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        새 사무실 / 건물 추가, 좌표 자동 보정, 직접 lat/lng 입력.
      </p>
      <BuildingsEditor
        offices={(offices ?? []) as Office[]}
        buildings={(buildings ?? []) as OfficeBuilding[]}
      />
    </main>
  );
}
