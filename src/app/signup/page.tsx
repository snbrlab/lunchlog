import Link from 'next/link';
import SignupForm from './SignupForm';

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">🍱 런치로그 가입 신청</h1>
          <p className="mt-2 text-sm text-neutral-500">
            관리자가 승인하면 가입이 완료돼.
          </p>
        </div>
        <SignupForm />
        <div className="mt-6 text-center text-xs text-neutral-500">
          이미 계정 있어?{' '}
          <Link href="/login" className="underline-offset-2 hover:underline">
            로그인하러 가기
          </Link>
        </div>
      </div>
    </main>
  );
}
