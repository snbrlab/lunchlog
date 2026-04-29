// 서버 측 Supabase 클라이언트 (Server Components / Route Handlers / Server Actions)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component 에서 호출되면 set 이 막혀 있어 throw 되는데
          // middleware 에서 세션을 갱신하고 있으므로 무시해도 안전.
        }
      },
    },
  });
}
