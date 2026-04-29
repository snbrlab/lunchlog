// Admin 이 신규 사용자를 직접 생성 + 임시 비번 발급.
// 회사 메일이 매직링크 호환 안 되는 환경에서 가입 우회용.
// Usage:
//   node --env-file=.env.local scripts/admin-create-user.mjs <email> <password> [name]
// 예: node --env-file=.env.local scripts/admin-create-user.mjs inhee.yeo@lge.com 'TempPass123' 인희

import { createClient } from '@supabase/supabase-js';

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.error(
    'Usage: node --env-file=.env.local scripts/admin-create-user.mjs <email> <password> [name]',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. auth.users 생성 (email_confirm: true 로 컨펌 메일 우회)
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createError) {
  console.error('createUser error:', createError.message);
  process.exit(1);
}

const user = created.user;
if (!user) {
  console.error('createUser returned no user');
  process.exit(1);
}

// 2. public.users 프로필 생성 (avatar_color 는 간단한 파스텔 팔레트)
const PALETTE = ['#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8', '#c7d2fe', '#fcd34d'];
const avatarColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
const displayName = name || email.split('@')[0];

const { error: profileError } = await supabase.from('users').insert({
  id: user.id,
  email,
  name: displayName,
  avatar_color: avatarColor,
  password_set: true,
});
if (profileError) {
  console.error('users insert error:', profileError.message);
  console.error('주의: auth.users 에는 생성됐지만 public.users 행이 없습니다. 다음 로그인 시 콜백이 자동 처리하거나, 수동으로 행 추가 필요.');
  process.exit(1);
}

console.log(`✓ ${email} 가입 완료.`);
console.log(`  표시 이름: ${displayName}`);
console.log(`  임시 비번: 사용자에게 직접 전달 (이 출력은 노출 금지)`);
console.log(``);
console.log(`사용자 안내:`);
console.log(`  1) https://lunchlog-rho.vercel.app/login 에서 이메일 + 위 비번으로 로그인`);
console.log(`  2) /onboarding 으로 자동 이동 → 사무실/건물/이모지/이름 선택`);
console.log(`  3) /me 에서 비번 변경 권장`);
