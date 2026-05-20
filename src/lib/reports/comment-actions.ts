'use server';

// D69: 제보 댓글 (ping-pong) + 제보 삭제 (admin).

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

const MAX_BODY = 2000;

export type AddCommentResult = { ok: true; id: string } | { ok: false; message: string };

// ping-pong: 직전 댓글 author 가 본인이면 거부. 댓글 없으면 admin 만 최초 응답 가능.
export async function addReportComment(
  reportId: string,
  body: string,
): Promise<AddCommentResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: '내용을 입력해주세요' };
  if (trimmed.length > MAX_BODY) {
    return { ok: false, message: `${MAX_BODY}자 이내로 입력해주세요` };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const sa = getSupabaseAdminClient();
  const [reportRes, profileRes, lastRes] = await Promise.all([
    sa.from('reports').select('id, author_id').eq('id', reportId).maybeSingle(),
    sa.from('users').select('role').eq('id', user.id).maybeSingle(),
    sa
      .from('report_comments')
      .select('author_id')
      .eq('report_id', reportId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const report = reportRes.data as { id: string; author_id: string | null } | null;
  if (!report) return { ok: false, message: '제보를 찾을 수 없어요' };

  const isAdmin = (profileRes.data as { role?: string } | null)?.role === 'admin';
  const isReporter = report.author_id === user.id;
  if (!isAdmin && !isReporter) return { ok: false, message: '권한이 없어요' };

  const last = lastRes.data as { author_id: string | null } | null;
  if (!last) {
    // 댓글이 없으면 → 제보 본문이 사용자 게시본이므로 admin 차례
    if (!isAdmin) {
      return { ok: false, message: '관리자 응답을 먼저 기다려주세요' };
    }
  } else if (last.author_id === user.id) {
    return { ok: false, message: '상대 응답을 기다려주세요' };
  }

  const { data: inserted, error } = await supabase
    .from('report_comments')
    .insert({ report_id: reportId, author_id: user.id, body: trimmed })
    .select('id')
    .single();
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: inserted.id };
}

export type DeleteReportResult = { ok: true } | { ok: false; message: string };

export async function deleteReport(reportId: string): Promise<DeleteReportResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: '로그인이 필요해요' };

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin') return { ok: false, message: '관리자만 삭제 가능' };

  const { error } = await supabase.from('reports').delete().eq('id', reportId);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
