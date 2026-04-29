'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportStatus } from '@/types/db';

export type UpdateReportResult =
  | { ok: true }
  | { ok: false; message: string };

interface UpdateReportInput {
  status?: ReportStatus;
  adminNote?: string;
}

export async function updateReport(
  reportId: string,
  input: UpdateReportInput,
): Promise<UpdateReportResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해' };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, message: '관리자만' };

  const update: Record<string, unknown> = {};
  if (input.status) {
    update.status = input.status;
    if (input.status === 'resolved') update.resolved_at = new Date().toISOString();
    else update.resolved_at = null;
  }
  if (input.adminNote !== undefined) {
    update.admin_note = input.adminNote.trim() || null;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await supabase.from('reports').update(update).eq('id', reportId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
