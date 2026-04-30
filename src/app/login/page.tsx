import LoginForm from './LoginForm';

const ERROR_MESSAGES: Record<string, string> = {
  domain: '허용된 회사 이메일이 아니라 자동 로그아웃됐어요',
  exchange: '로그인 링크 처리 중 오류가 났어요. 다시 시도해주세요',
  unknown: '알 수 없는 오류가 났어요',
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
          <p className="mt-2 text-sm text-neutral-500">가본 곳에 한 줄 평 남기기</p>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <LoginForm />
      </div>
    </main>
  );
}
