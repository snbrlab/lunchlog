import { Header } from '@/components/Header';
import { MealModeProvider } from '@/lib/meal-mode/MealModeProvider';

// 인증/온보딩 완료된 사용자 영역 공용 레이아웃.
// /login, /onboarding 은 이 레이아웃을 사용하지 않는다.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MealModeProvider>
      <Header />
      <div className="flex flex-1 flex-col bg-bg text-fg">{children}</div>
    </MealModeProvider>
  );
}
