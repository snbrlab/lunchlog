// 카드사 "서울시 로컬브랜드 가맹점" 이벤트 지도.
// card_event_merchants (scripts/import-card-event.mjs 가 채워넣음) 를 구별로 보여주고,
// 런치로그에 이미 있는 식당이면 리뷰쓰기로, 없으면 신규 등록으로 이어준다.

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CARD_EVENT_ID } from '@/lib/card-event/districts';
import { CardEventShell } from './CardEventShell';

export interface CardEventMerchantRow {
  id: string;
  district: string;
  district_label: string;
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  matched_restaurant_id: string | null;
  matched: { id: string; name: string; is_closed: boolean } | null;
}

export default async function CardEventPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase
    .from('card_event_merchants')
    .select(
      'id, district, district_label, name, category, address, latitude, longitude, matched_restaurant_id, ' +
        'matched:restaurants!card_event_merchants_matched_restaurant_id_fkey ( id, name, is_closed )',
    )
    .eq('event_id', CARD_EVENT_ID)
    .eq('excluded', false)
    .order('name');

  return <CardEventShell merchants={(data ?? []) as unknown as CardEventMerchantRow[]} />;
}
