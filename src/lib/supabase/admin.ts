// service_role 키를 쓰는 Supabase 클라이언트.
// 절대 클라이언트 컴포넌트에서 import 하지 말 것 — server action / route handler 전용.
// 쿠키/세션 무시, RLS 우회.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { getServerEnv } from '@/lib/env';

let cached: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (cached) return cached;
  const { supabaseServiceRoleKey } = getServerEnv();
  cached = createClient(publicEnv.supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
