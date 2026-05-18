import { Header } from '@/components/Header';
import { NotificationToast } from '@/components/NotificationToast';
import { AnnouncementBanner } from '@/components/AnnouncementBanner';
import { MealModeProvider } from '@/lib/meal-mode/MealModeProvider';
import { getCachedActiveAnnouncements } from '@/lib/cache/announcements';

// 인증/온보딩 완료된 사용자 영역 공용 레이아웃.
// /login, /onboarding 은 이 레이아웃을 사용하지 않는다.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // D59 → D65: active 공지. 전 페이지 SSR 마다 DB 왕복하던 걸 캐시로
  // (전 사용자 공통, 작성/내리기/삭제 시 invalidate).
  const announcements = await getCachedActiveAnnouncements();

  return (
    <MealModeProvider>
      <Header />
      <AnnouncementBanner items={announcements} />
      <div className="flex flex-1 flex-col bg-bg text-fg">{children}</div>
      <NotificationToast />
    </MealModeProvider>
  );
}
