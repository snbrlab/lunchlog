'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import {
  renderDigestHtml,
  sendDigestEmail,
  type BroadcastStats,
  type DigestRecipient,
  type LastCommit,
} from '@/lib/email/broadcast';

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요해요');
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') throw new Error('관리자만 가능해요');
  return { userId: user.id, email: user.email ?? '' };
}

async function gatherStats(): Promise<BroadcastStats> {
  const sa = getSupabaseAdminClient();
  const [u, r, c] = await Promise.all([
    sa.from('users').select('id', { count: 'exact', head: true }),
    sa.from('restaurants').select('id', { count: 'exact', head: true }),
    sa.from('reviews').select('id', { count: 'exact', head: true }),
  ]);
  return {
    userCount: u.count ?? 0,
    restaurantCount: r.count ?? 0,
    commitCount: c.count ?? 0,
  };
}

export type BroadcastStatsResult =
  | { ok: true; stats: BroadcastStats; recipientCount: number; configured: boolean }
  | { ok: false; message: string };

export async function getBroadcastStats(): Promise<BroadcastStatsResult> {
  try {
    await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
  const sa = getSupabaseAdminClient();
  const [stats, { count }] = await Promise.all([
    gatherStats(),
    sa.from('users').select('id', { count: 'exact', head: true }),
  ]);
  const { brevoApiKey, brevoSenderEmail } = (await import('@/lib/env')).getServerEnv();
  return {
    ok: true,
    stats,
    recipientCount: count ?? 0,
    configured: !!brevoApiKey && !!brevoSenderEmail,
  };
}

// 한 사용자의 마지막 commit (reverted 제외 — 보여줄 만한 것만)
async function lastCommitFor(
  sa: ReturnType<typeof getSupabaseAdminClient>,
  userId: string,
): Promise<LastCommit | null> {
  const { data } = await sa
    .from('reviews')
    .select(
      'message, hash, created_at, reverted, restaurant:restaurants ( name )',
    )
    .eq('author_id', userId)
    .eq('reverted', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as {
    message: string;
    hash: string;
    created_at: string;
    restaurant: { name: string } | null;
  };
  return {
    message: row.message,
    hash: row.hash,
    restaurantName: row.restaurant?.name ?? null,
    createdAt: row.created_at,
  };
}

export type SendBroadcastResult =
  | { ok: true; sent: number; failed: number; failures: string[] }
  | { ok: false; message: string };

const SUBJECT = '🍱 런치로그 - 오늘 점심 커밋 완료?';

// testOnly=true → 요청한 admin 본인에게만 1통 (전체 발송 전 미리보기)
export async function sendBroadcastDigest(
  testOnly: boolean,
): Promise<SendBroadcastResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }

  const sa = getSupabaseAdminClient();
  const stats = await gatherStats();

  let targets: { id: string; email: string; name: string }[];
  if (testOnly) {
    const { data: me } = await sa
      .from('users')
      .select('id, email, name')
      .eq('id', admin.userId)
      .maybeSingle();
    if (!me?.email) return { ok: false, message: '본인 이메일을 찾을 수 없어요' };
    targets = [me as { id: string; email: string; name: string }];
  } else {
    const { data } = await sa.from('users').select('id, email, name');
    targets = ((data ?? []) as { id: string; email: string; name: string }[]).filter(
      (t) => !!t.email,
    );
  }

  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  // 순차 발송 + 소폭 딜레이 (Brevo rate limit 보수적). 실패해도 계속.
  for (const t of targets) {
    const lastCommit = await lastCommitFor(sa, t.id);
    const recipient: DigestRecipient = {
      email: t.email,
      name: t.name || t.email,
      lastCommit,
    };
    const html = renderDigestHtml(stats, recipient);
    const r = await sendDigestEmail(
      { email: t.email, name: recipient.name },
      SUBJECT,
      html,
    );
    if (r.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (failures.length < 10) failures.push(`${t.email}: ${r.error}`);
    }
    await new Promise((res) => setTimeout(res, 120));
  }

  return { ok: true, sent, failed, failures };
}
