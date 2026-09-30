// 카드사 "서울시 로컬브랜드 가맹점" 이벤트 매칭 검수.
// scripts/import-card-event.mjs 가 채워넣은 card_event_merchants 중
// 자동/후보 매칭과 지오코딩 실패 항목을 admin 이 확인 — 확정 매칭은 /events/card-2026 지도에서
// "런치로그로 이동해 리뷰쓰기" 로, 매칭 없음은 "식당 추가하기" 로 이어진다.

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CardEventAdminList } from './CardEventAdminList';

export interface AdminCardEventRow {
  id: string;
  district: string;
  district_label: string;
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  geocode_status: 'pending' | 'ok' | 'failed';
  matched_restaurant_id: string | null;
  match_confidence: 'auto' | 'suggested' | 'none';
  reviewed: boolean;
  excluded: boolean;
  matched: { id: string; name: string } | null;
}

export default async function AdminCardEventPage() {
  const supabase = await createSupabaseServerClient();

  const { count: total } = await supabase
    .from('card_event_merchants')
    .select('id', { count: 'exact', head: true });
  const { count: autoCount } = await supabase
    .from('card_event_merchants')
    .select('id', { count: 'exact', head: true })
    .eq('match_confidence', 'auto');
  const { count: suggestedCount } = await supabase
    .from('card_event_merchants')
    .select('id', { count: 'exact', head: true })
    .eq('match_confidence', 'suggested');
  const { count: failedCount } = await supabase
    .from('card_event_merchants')
    .select('id', { count: 'exact', head: true })
    .eq('geocode_status', 'failed');
  const { count: excludedCount } = await supabase
    .from('card_event_merchants')
    .select('id', { count: 'exact', head: true })
    .eq('excluded', true);

  // 검수 우선순위 큐: 매칭 후보가 있거나 좌표가 없는 것들. 나머지(매칭 없음+좌표 있음)는
  // 대부분 "아직 런치로그에 없는 새 식당"이라 검수 필요 없이 지도에서 바로 '추가하기'로 흘러감.
  const { data } = await supabase
    .from('card_event_merchants')
    .select(
      'id, district, district_label, name, category, address, latitude, longitude, ' +
        'geocode_status, matched_restaurant_id, match_confidence, reviewed, excluded, ' +
        'matched:restaurants!card_event_merchants_matched_restaurant_id_fkey ( id, name )',
    )
    .or('match_confidence.in.(auto,suggested),geocode_status.eq.failed')
    .order('district_label', { ascending: true })
    .order('match_confidence', { ascending: true })
    .limit(1000);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">🎟️ 카드사 이벤트 매칭 검수</h1>
      <p className="mb-6 text-xs text-fg-muted">
        서울시 로컬브랜드 가맹점 {total ?? 0}개 · 자동매칭 {autoCount ?? 0} · 후보매칭{' '}
        {suggestedCount ?? 0} · 좌표없음 {failedCount ?? 0} · 제외 {excludedCount ?? 0}
      </p>
      <CardEventAdminList rows={(data ?? []) as unknown as AdminCardEventRow[]} />
    </main>
  );
}
