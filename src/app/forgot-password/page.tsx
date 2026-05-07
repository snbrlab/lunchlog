import Link from 'next/link';
import ForgotPasswordForm from './ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">🔑 비밀번호 재설정</h1>
          <p className="mt-2 text-sm text-neutral-500">
            가입한 회사 이메일로 재설정 링크를 보내드릴게요.
          </p>
        </div>
        <ForgotPasswordForm />
        <div className="mt-6 text-center text-xs text-neutral-500">
          <Link href="/login" className="underline-offset-2 hover:underline">
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
