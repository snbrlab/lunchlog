// 임시 admin 스크립트: 매직링크 막혔을 때 비번 직접 설정.
// Usage:
//   node --env-file=.env.local scripts/admin-set-password.mjs <email> <new-password>
// 예: node --env-file=.env.local scripts/admin-set-password.mjs heejin.suh@lge.com 'MyPass1234'

import { createClient } from '@supabase/supabase-js';

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/admin-set-password.mjs <email> <password>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// service_role 키인지 사전 검증 (anon 키를 잘못 박는 흔한 실수 잡기)
try {
  const payload = JSON.parse(
    Buffer.from(serviceKey.split('.')[1] ?? '', 'base64url').toString('utf8'),
  );
  if (payload.role && payload.role !== 'service_role') {
    console.error(
      `SUPABASE_SERVICE_ROLE_KEY 의 role claim 이 "${payload.role}" 임. service_role 키여야 함.\n` +
        '→ Supabase Dashboard → Project Settings → API → service_role 키 다시 복사 필요.',
    );
    process.exit(1);
  }
} catch {
  // 새 형식 (sb_secret_...) 일 수 있음. 진짜 권한 부족이면 listUsers 에서 실패함.
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error('listUsers error:', listError.message);
  process.exit(1);
}
const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error('User not found:', email);
  process.exit(1);
}

const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
if (updateError) {
  console.error('updateUserById error:', updateError.message);
  process.exit(1);
}

const { error: profileError } = await supabase
  .from('users')
  .update({ password_set: true })
  .eq('id', user.id);
if (profileError) {
  console.error('users update error:', profileError.message);
  process.exit(1);
}

console.log(`✓ Password set for ${email}. password_set = true 로 업데이트 완료.`);
