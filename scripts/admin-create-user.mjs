// Admin 이 신규 사용자 생성 + 임시 비번 발급. 이미 auth 에 있으면 비번만 갱신.
// Usage:
//   node --env-file=.env.local scripts/admin-create-user.mjs <email> <password> [name]

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

let userId;
let userEmail = email;
let firstTime = true;

// 1. auth.users 생성 시도. 이미 있으면 비번만 갱신.
const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createError) {
  if (createError.message.toLowerCase().includes('already')) {
    console.log('이미 가입된 사용자 — 비번만 갱신합니다.');
    firstTime = false;
    const { data: list, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.error('listUsers error:', listError.message);
      process.exit(1);
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      console.error('충돌인데 사용자를 못 찾음');
      process.exit(1);
    }
    userId = existing.id;
    userEmail = existing.email ?? email;
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
    if (updateError) {
      console.error('updateUserById error:', updateError.message);
      process.exit(1);
    }
  } else {
    console.error('createUser error:', createError.message);
    process.exit(1);
  }
} else if (created.user) {
  userId = created.user.id;
  userEmail = created.user.email ?? email;
} else {
  console.error('createUser returned no user');
  process.exit(1);
}

// 2. public.users 프로필 보장 (upsert). 이미 있으면 password_set 만 true 로.
const PALETTE = ['#fde68a', '#a7f3d0', '#bfdbfe', '#fbcfe8', '#c7d2fe', '#fcd34d'];
const avatarColor = PALETTE[Math.floor(Math.random() * PALETTE.length)];
const displayName = name || userEmail.split('@')[0];

const { error: upsertError } = await supabase
  .from('users')
  .upsert(
    {
      id: userId,
      email: userEmail,
      name: displayName,
      avatar_color: avatarColor,
      password_set: true,
    },
    { onConflict: 'id', ignoreDuplicates: false },
  );

if (upsertError) {
  console.error('users upsert error:', upsertError.message);
  process.exit(1);
}

console.log(`✓ ${userEmail} ${firstTime ? '신규 가입' : '비번 갱신'} 완료.`);
console.log(`  표시 이름: ${displayName}`);
console.log(``);
console.log(`사용자 안내:`);
console.log(`  1) https://lunchlog-rho.vercel.app/login → 이메일 + 위 비번으로 로그인`);
console.log(`  2) /onboarding 으로 자동 이동 → 사무실/건물/이모지/이름 선택`);
console.log(`  3) /me 에서 비번 변경 권장`);
