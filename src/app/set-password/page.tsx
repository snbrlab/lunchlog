import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SetPasswordForm from './SetPasswordForm';

// admin 이 비번을 reset 한 사용자가 새 비번을 설정하는 페이지.
// password_set === true 면 /map 으로 (재진입 차단).
export default async function SetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('password_set')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.password_set) redirect('/map');

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-xl font-semibold tracking-tight">비밀번호 설정 🔒</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            관리자가 발급한 임시 비밀번호로 로그인했어.<br />
            본인이 쓸 새 비밀번호를 정해줘.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
