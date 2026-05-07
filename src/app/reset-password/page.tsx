import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import ResetPasswordForm from './ResetPasswordForm';

// reset 메일 링크 → /auth/callback → 여기로. 세션이 있어야 진입 가능.
export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/forgot-password?error=session');

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">🔑 새 비밀번호 설정</h1>
          <p className="mt-2 text-sm text-neutral-500">
            새로 사용할 비밀번호를 입력해주세요.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </main>
  );
}
