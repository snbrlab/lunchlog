import { getBroadcastStats, listRecentCommits } from '@/lib/admin/broadcast-actions';
import BroadcastPanel from './BroadcastPanel';

// D66: 전체메일 다이제스트 — admin 이 통계 + 개인화 "나의 마지막 commit" 매거진 발송
export default async function AdminBroadcastPage() {
  const [res, commitsRes] = await Promise.all([
    getBroadcastStats(),
    listRecentCommits(),
  ]);

  if (!res.ok) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-8">
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">📨 전체메일</h1>
        <p className="text-sm text-red-500">{res.message}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="mb-2 text-xl font-semibold tracking-tight text-fg">📨 전체메일 다이제스트</h1>
      <p className="mb-6 text-xs text-fg-muted">
        현황 통계 + 수신자별 “나의 마지막 commit” 을 매거진풍 HTML 로 발송. 되돌릴 수 없어요 —
        먼저 “나에게 테스트” 로 확인 후 전체 발송하세요.
      </p>
      <BroadcastPanel
        stats={res.stats}
        recipientCount={res.recipientCount}
        configured={res.configured}
        recentCommits={commitsRes.ok ? commitsRes.commits : []}
      />
    </main>
  );
}
