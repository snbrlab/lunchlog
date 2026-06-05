// admin 권한 체크 헬퍼 — 모든 admin server action 의 공통 진입점.
// 두 곳 (admin/actions.ts, pull-requests/actions.ts) 에 사본이 있던 걸 여기로 통합.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AdminContext {
  supabase: SupabaseClient;
  userId: string;
}

export async function requireAdmin(): Promise<AdminContext> {
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
  return { supabase, userId: user.id };
}
