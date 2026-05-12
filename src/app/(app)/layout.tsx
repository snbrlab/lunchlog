import { Header } from '@/components/Header';
import { NotificationToast } from '@/components/NotificationToast';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { MealModeProvider } from '@/lib/meal-mode/MealModeProvider';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// 인증/온보딩 완료된 사용자 영역 공용 레이아웃.
// /login, /onboarding 은 이 레이아웃을 사용하지 않는다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // D59: active 공지 배너 — 모든 (app) 페이지에 표시. 가벼운 쿼리 (1~2건 평균)
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('announcements')
    .select('id, body')
    .eq('active', true)
    .order('created_at', { ascending: false });
  const announcements = (data ?? []) as { id: string; body: string }[];

  return (
    <MealModeProvider>
      <Header />
      <AnnouncementBanner items={announcements} />
      <div className="flex flex-1 flex-col bg-bg text-fg">{children}</div>
      <NotificationToast />
    </MealModeProvider>
  );
}
