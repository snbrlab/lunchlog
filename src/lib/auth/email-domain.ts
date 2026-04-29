// 이메일 도메인 화이트리스트 검증 (D1)
// 서버 전용 (ALLOWED_EMAIL_DOMAINS 는 NEXT_PUBLIC_ 아님)

import { getServerEnv } from '@/lib/env';

export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at === -1 || at === email.length - 1) return null;
  return email.slice(at + 1).toLowerCase();
}

export function isAllowedEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return getServerEnv().allowedEmailDomains.includes(domain);
}

export function suggestNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  // 점/언더스코어/하이픈으로 split 해서 첫 토큰만. 없으면 그대로.
  const first = local.split(/[._-]/)[0] ?? local;
  return first.length > 0 ? first : local;
}
