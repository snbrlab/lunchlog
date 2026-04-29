import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import SetPasswordForm from './SetPasswordForm';

// 매직링크로 가입한 사용자가 비번을 직접 설정하는 페이지.
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
            외부망에서도 로그인할 수 있도록 비밀번호를 정해줘.<br />
            한 번 설정하면 다음부턴 매직링크 없이 바로 로그인 가능.
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
