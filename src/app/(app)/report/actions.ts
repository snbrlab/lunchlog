'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportCategory } from '@/types/db';

export type CreateReportResult =
  | { ok: false; reason: 'invalid' | 'unknown'; message: string };
// ok: true 시엔 redirect

const ALLOWED: ReportCategory[] = ['bug', 'feature', 'restaurant', 'other'];

export async function createReport(formData: FormData): Promise<CreateReportResult> {
  const category = String(formData.get('category') ?? '') as ReportCategory;
  const message = String(formData.get('message') ?? '').trim();

  if (!ALLOWED.includes(category)) {
    return { ok: false, reason: 'invalid', message: '카테고리를 선택해줘' };
  }
  if (!message) {
    return { ok: false, reason: 'invalid', message: '내용을 입력해줘' };
  }
  if (message.length > 1000) {
    return { ok: false, reason: 'invalid', message: '1000자 이내로 줄여줘' };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'invalid', message: '로그인이 필요해' };

  const { error } = await supabase.from('reports').insert({
    author_id: user.id,
    category,
    message,
  });
  if (error) return { ok: false, reason: 'unknown', message: error.message };

  redirect('/report?sent=1');
}
