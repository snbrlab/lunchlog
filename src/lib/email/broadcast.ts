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

// D66: admin 이 골라 첨부하는 "흥미로운 commit"
export interface PickedCommit {
  hash: string;
  message: string;
  authorName: string;
  restaurantName: string | null;
  createdAt: string;
}

const SITE_URL = 'https://lunchlog-rho.vercel.app';

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
  picks: PickedCommit[] = [],
): string {
  const amber = '#d97706';
  const ink = '#1a1a1a';
  const muted = '#6b6b6b';
  const line = '#ececec';

  const mono = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

  // KST 날짜 기준 "며칠 전" 계산 (1일1커밋 streak 메시지용)
  const ymd = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: KST }).format(d);
  const lc = recipient.lastCommit;
  let daysSince: number | null = null;
  if (lc) {
    const a = new Date(`${ymd(new Date(lc.createdAt))}T00:00:00+09:00`).getTime();
    const b = new Date(`${ymd(new Date())}T00:00:00+09:00`).getTime();
    daysSince = Math.max(0, Math.round((b - a) / 86_400_000));
  }

  // 1일1커밋 잔디 — 최근 7칸. 마지막 커밋이 N일 전이면 그날 칸만 채워진 모습
  const grass = Array.from({ length: 7 }, (_, i) => {
    const fromRight = 6 - i; // 0 = 오늘
    const filled = daysSince !== null && daysSince === fromRight;
    const bg = filled ? amber : '#ebedf0';
    return `<td style="padding:2px;"><div style="width:16px;height:16px;border-radius:3px;background:${bg};"></div></td>`;
  }).join('');

  const streakLine =
    daysSince === null
      ? '아직 한 끼도 커밋 안 했어요 — 오늘 먹은 한 끼부터 남겨볼까요? 🌱'
      : daysSince === 0
        ? '오늘 한 끼 커밋 완료 ✅ 잔디 한 칸 채웠어요!'
        : daysSince === 1
          ? '어제 한 끼가 마지막이에요. 오늘 먹은 한 끼, 커밋했어요?'
          : `마지막 커밋이 <b style="color:${ink}">${daysSince}일 전</b>이에요. 그동안 먹은 한 끼들, 잔디가 비어 있어요 🥲`;

  const lastCommitCard = lc
    ? `
      <div style="margin-top:12px;border:1px solid ${line};border-radius:10px;padding:14px 16px;background:#fffdf7;">
        <div style="font:600 11px/1 ${mono};color:${amber};">
          ${esc(lc.hash)} · ${esc(DATE_FMT.format(new Date(lc.createdAt)))}
        </div>
        <div style="margin-top:8px;font:600 14px/1.5 ${sans};color:${ink};">
          ${esc(lc.restaurantName ?? '(삭제된 식당)')}
        </div>
        <div style="margin-top:4px;font:400 14px/1.6 ${sans};color:${ink};">
          “${esc(lc.message)}”
        </div>
      </div>`
    : '';

  const picksSection =
    picks.length === 0
      ? ''
      : `
      <div style="padding:0 24px 22px;">
        <div style="border-top:1px solid ${line};padding-top:18px;font:700 13px/1 ${sans};color:${ink};">
          👀 이런 한 줄도 있어요
        </div>
        ${picks
          .map(
            (p) => `
        <div style="margin-top:12px;border:1px solid ${line};border-radius:10px;padding:13px 15px;background:#fcfcfb;">
          <div style="font:600 11px/1 ${mono};color:${amber};">
            ${esc(p.hash)} · ${esc(p.authorName)} · ${esc(DATE_FMT.format(new Date(p.createdAt)))}
          </div>
          <div style="margin-top:7px;font:600 13px/1.5 ${sans};color:${ink};">
            ${esc(p.restaurantName ?? '(삭제된 식당)')}
          </div>
          <div style="margin-top:3px;font:400 13px/1.6 ${sans};color:${ink};">
            “${esc(p.message)}”
          </div>
        </div>`,
          )
          .join('')}
      </div>`;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LUNCHLOG</title></head>
<body style="margin:0;padding:0;background:#f4f4f1;">
  <div style="max-width:520px;margin:0 auto;padding:28px 18px;">
    <div style="background:#ffffff;border:1px solid ${line};border-radius:14px;overflow:hidden;">

      <!-- 후크 (메일 최상단) -->
      <div style="padding:26px 24px 16px;">
        <div style="font:800 18px/1.4 ${sans};color:${ink};">
          ${esc(recipient.name)} 님,<br/>오늘 점심 드셨어요? 🍱
        </div>
        <div style="margin-top:10px;font:400 13px/1.6 ${sans};color:${muted};">
          그동안 동료들이 이만큼 쌓아놨어요 — 구경하러 올래요?
        </div>
      </div>

      <!-- 커뮤니티 현황 (메인 후크: 이만큼 쌓였으니 구경 와) -->
      <div style="padding:0 20px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:8px 0;">
          <tr>
            <td width="33%" style="background:#fafaf7;border:1px solid ${line};border-radius:12px;padding:18px 6px;text-align:center;">
              <div style="font:800 26px/1 ${mono};color:${ink};">${stats.userCount}</div>
              <div style="margin-top:6px;font:500 11px/1 ${sans};color:${muted};">참여 동료</div>
            </td>
            <td width="33%" style="background:#fafaf7;border:1px solid ${line};border-radius:12px;padding:18px 6px;text-align:center;">
              <div style="font:800 26px/1 ${mono};color:${ink};">${stats.restaurantCount}</div>
              <div style="margin-top:6px;font:500 11px/1 ${sans};color:${muted};">등록 맛집</div>
            </td>
            <td width="33%" style="background:#fff7ec;border:1px solid #f3d9a8;border-radius:12px;padding:18px 6px;text-align:center;">
              <div style="font:800 26px/1 ${mono};color:${amber};">${stats.commitCount}</div>
              <div style="margin-top:6px;font:500 11px/1 ${sans};color:${amber};">쌓인 commit</div>
            </td>
          </tr>
        </table>
        <a href="${SITE_URL}/log"
           style="display:block;margin-top:16px;background:${ink};color:#fff;text-decoration:none;text-align:center;padding:14px 0;border-radius:10px;font:700 14px/1 ${sans};">
          동료들 한 줄 평 구경하러 가기 →
        </a>
      </div>

      <!-- 에디터 픽: admin 이 고른 흥미로운 commit -->
      ${picksSection}

      <!-- 개인화: 나의 1일1커밋 -->
      <div style="padding:0 24px 24px;">
        <div style="border-top:1px solid ${line};padding-top:18px;font:700 13px/1 ${sans};color:${ink};">
          나의 commit 잔디
        </div>
        <div style="margin-top:12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>${grass}</tr>
          </table>
        </div>
        <div style="margin-top:12px;font:400 13px/1.6 ${sans};color:${muted};">
          ${streakLine}
        </div>
        ${lastCommitCard}
        <a href="${SITE_URL}/map"
           style="display:block;margin-top:18px;border:1px solid ${ink};color:${ink};text-decoration:none;text-align:center;padding:13px 0;border-radius:10px;font:700 13px/1 ${mono};letter-spacing:0.3px;">
          git commit -m "오늘 점심 …" →
        </a>
      </div>

      <!-- masthead (메일 최하단 브랜드 사인오프) -->
      <div style="border-top:2px solid ${ink};padding:22px 24px 24px;text-align:center;">
        <div style="font:800 22px/1 ${mono};letter-spacing:1px;color:${ink};">
          LUNCH<span style="color:${amber};">LOG</span>
        </div>
        <div style="margin-top:7px;font:400 12px/1 ${mono};color:${muted};">
          오늘 먹은 한 끼를 커밋합니다
        </div>
      </div>
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
