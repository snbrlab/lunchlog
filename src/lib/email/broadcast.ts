// D66: 전체메일 다이제스트 — 통계 + 개인화 HTML + Brevo transactional 발송.
//
// "나의 마지막 commit" 개인화가 들어가므로 한 통 broadcast 가 아니라
// 사용자별 렌더 + 개별 발송. Brevo transactional API (SMTP relay 와 별개).
//
// 회사 메일 Outlook Safe Links 가 링크를 미리 클릭하는 사고(D30) 이력 →
// 링크는 CTA 하나로 최소화.

import { getServerEnv } from '@/lib/env';

const KST = 'Asia/Seoul';
const DATE_FMT = new Intl.DateTimeFormat('ko-KR', {
  timeZone: KST,
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export interface BroadcastStats {
  userCount: number;
  restaurantCount: number;
  commitCount: number;
}

export interface LastCommit {
  message: string;
  hash: string;
  restaurantName: string | null;
  createdAt: string;
}

export interface DigestRecipient {
  email: string;
  name: string;
  lastCommit: LastCommit | null;
}

const SITE_URL = 'https://lunchlog.vercel.app';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 매거진풍 한 통. 인라인 CSS (메일 클라이언트는 <style> 대부분 무시).
export function renderDigestHtml(
  stats: BroadcastStats,
  recipient: DigestRecipient,
): string {
  const amber = '#d97706';
  const ink = '#1a1a1a';
  const muted = '#6b6b6b';
  const line = '#ececec';

  const lc = recipient.lastCommit;
  const lastCommitBlock = lc
    ? `
      <div style="margin-top:8px;border:1px solid ${line};border-radius:10px;padding:14px 16px;background:#fffdf7;">
        <div style="font:600 11px/1 ui-monospace,Menlo,monospace;color:${amber};">
          ${esc(lc.hash)} · ${esc(DATE_FMT.format(new Date(lc.createdAt)))}
        </div>
        <div style="margin-top:8px;font:600 14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ink};">
          ${esc(lc.restaurantName ?? '(삭제된 식당)')}
        </div>
        <div style="margin-top:4px;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ink};">
          “${esc(lc.message)}”
        </div>
      </div>`
    : `
      <div style="margin-top:8px;border:1px dashed ${line};border-radius:10px;padding:18px 16px;background:#fafafa;text-align:center;color:${muted};font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        아직 남긴 commit 이 없어요.<br/>오늘 점심 한 줄, 첫 commit 어때요? 🍱
      </div>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>런치로그</title></head>
<body style="margin:0;padding:0;background:#f4f4f1;">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px;">
    <div style="background:#ffffff;border:1px solid ${line};border-radius:16px;overflow:hidden;">
      <div style="padding:22px 24px 16px;border-bottom:1px solid ${line};">
        <div style="font:800 20px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${ink};">
          🍱 런치로그 <span style="color:${amber};">현황</span>
        </div>
        <div style="margin-top:6px;font:400 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${muted};">
          ${esc(recipient.name)} 님, 동료들이 이렇게 모이고 있어요
        </div>
      </div>

      <div style="display:flex;padding:18px 12px;text-align:center;">
        <div style="flex:1;padding:0 6px;">
          <div style="font:800 24px/1 -apple-system,sans-serif;color:${ink};">${stats.userCount}</div>
          <div style="margin-top:5px;font:500 11px/1 -apple-system,sans-serif;color:${muted};">사용자</div>
        </div>
        <div style="flex:1;padding:0 6px;border-left:1px solid ${line};">
          <div style="font:800 24px/1 -apple-system,sans-serif;color:${ink};">${stats.restaurantCount}</div>
          <div style="margin-top:5px;font:500 11px/1 -apple-system,sans-serif;color:${muted};">등록 식당</div>
        </div>
        <div style="flex:1;padding:0 6px;border-left:1px solid ${line};">
          <div style="font:800 24px/1 -apple-system,sans-serif;color:${amber};">${stats.commitCount}</div>
          <div style="margin-top:5px;font:500 11px/1 -apple-system,sans-serif;color:${muted};">commit</div>
        </div>
      </div>

      <div style="padding:4px 24px 22px;">
        <div style="font:700 13px/1 -apple-system,sans-serif;color:${ink};">나의 마지막 commit</div>
        ${lastCommitBlock}
        <a href="${SITE_URL}/map"
           style="display:block;margin-top:20px;background:${ink};color:#fff;text-decoration:none;text-align:center;padding:13px 0;border-radius:10px;font:700 14px/1 -apple-system,sans-serif;">
          오늘 점심 한 줄 남기러 가기 →
        </a>
      </div>
    </div>
    <div style="text-align:center;margin-top:14px;font:400 11px/1.6 -apple-system,sans-serif;color:#9b9b9b;">
      사내 동료들끼리 맛집을 git commit 처럼 공유하는 런치로그
    </div>
  </div>
</body></html>`;
}

export type SendResult = { ok: true } | { ok: false; error: string };

// Brevo transactional API 단건 발송.
export async function sendDigestEmail(
  to: { email: string; name: string },
  subject: string,
  html: string,
): Promise<SendResult> {
  const env = getServerEnv();
  if (!env.brevoApiKey || !env.brevoSenderEmail) {
    return {
      ok: false,
      error: 'BREVO_API_KEY / BREVO_SENDER_EMAIL 환경변수가 필요해요',
    };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.brevoApiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
        to: [{ email: to.email, name: to.name }],
        subject,
        htmlContent: html,
      }),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `Brevo ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
