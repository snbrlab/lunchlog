import { createSupabaseServerClient } from '@/lib/supabase/server';
import RestaurantsAdminTable from './RestaurantsAdminTable';

interface Row {
  id: string;
  name: string;
  cuisine_types: string[];
  is_closed: boolean;
  commit_count: number;
  created_at: string;
  kakao_place_url: string | null;
  creator: { name: string } | null;
}

export default async function AdminRestaurantsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('restaurants')
    .select(
      'id, name, cuisine_types, is_closed, commit_count, created_at, kakao_place_url, ' +
        'creator:users!restaurants_created_by_fkey ( name )',
    )
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">식당 관리</h1>
      <p className="mb-6 text-xs text-fg-muted">
        폐업 토글 / 삭제. 삭제하면 해당 식당의 리뷰도 cascade 로 같이 사라져.
      </p>
      <RestaurantsAdminTable rows={(data ?? []) as unknown as Row[]} />
    </main>
  );
}
