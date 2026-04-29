import LoginForm from './LoginForm';

const ERROR_MESSAGES: Record<string, string> = {
  domain: '허용된 회사 이메일이 아니라 자동 로그아웃됐어',
  exchange: '로그인 링크 처리 중 오류가 났어. 다시 시도해줘',
  unknown: '알 수 없는 오류가 났어',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const sp = await searchParams;
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] ?? ERROR_MESSAGES.unknown : null;

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">🍱 런치로그</h1>
          <p className="mt-2 text-sm text-neutral-500">사내 동료끼리 쓰는 점심·저녁 지도</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <LoginForm />

        <p className="mt-8 text-center text-xs text-neutral-400">
          가입 가능한 도메인만 매직링크가 발송됩니다.
        </p>
      </div>
    </main>
  );
}
