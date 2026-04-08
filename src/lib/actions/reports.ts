'use server';

/**
 * Phase 5a — 리포트 스냅샷 Server Actions.
 *
 * saveReport(clientId, snapshot) → { ok, id } | { ok:false, error }
 * loadReport(id)               → { ok, data } | { ok:false, error }
 */
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { reportSnapshotSchema, type ReportSnapshot } from '@/lib/schemas/report';

type SaveOk = { ok: true; id: string };
type LoadOk = {
  ok: true;
  data: { snapshot: ReportSnapshot; aiReview: string | null; createdAt: string };
};
type Err = { ok: false; error: string };

export async function saveReport(clientId: string, raw: unknown): Promise<SaveOk | Err> {
  if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
  const parsed = reportSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: '리포트 스냅샷 검증 실패: ' + parsed.error.issues[0]?.message };
  }

  const id = randomUUID();
  const supabase = supabaseServer;
  const { error } = await supabase.from('reports').insert({
    id,
    client_id: clientId,
    payload: parsed.data,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}

export async function loadReport(id: string): Promise<LoadOk | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const supabase = supabaseServer;
  const { data, error } = await supabase
    .from('reports')
    .select('payload, ai_review, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: '리포트를 찾을 수 없습니다.' };

  const parsed = reportSnapshotSchema.safeParse(data.payload);
  if (!parsed.success) {
    return { ok: false, error: '저장된 데이터가 현재 스키마와 호환되지 않습니다.' };
  }
  return {
    ok: true,
    data: {
      snapshot: parsed.data,
      aiReview: data.ai_review,
      createdAt: data.created_at,
    },
  };
}

export async function saveAiReview(id: string, review: string): Promise<{ ok: true } | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const supabase = supabaseServer;
  const { error } = await supabase.from('reports').update({ ai_review: review }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
