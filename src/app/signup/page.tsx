import Link from 'next/link';
import SignupForm from './SignupForm';

export default function SignupPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">🍱 런치로그 회원가입</h1>
          <p className="mt-2 text-sm text-neutral-500">
            회사 이메일로 인증 코드를 받아 가입해요.
          </p>
        </div>
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-center text-xs leading-relaxed text-amber-900">
          사내 동료들과 함께 쌓는 commit log 예요.<br />
          가볍고 따뜻한 한 줄 부탁해요 ☕
        </div>
        <SignupForm />
        <div className="mt-6 text-center text-xs text-neutral-500">
          이미 계정 있어?{' '}
          <Link href="/login" className="underline-offset-2 hover:underline">
            로그인하러 가기
          </Link>
        </div>
        <div className="mt-4 text-center text-[11px] text-neutral-400">
          <Link href="/terms" className="underline-offset-2 hover:underline">
            이용약관
          </Link>
          {' · '}
          <Link href="/privacy" className="underline-offset-2 hover:underline">
            개인정보 처리방침
          </Link>
        </div>
      </div>
    </main>
  );
}
