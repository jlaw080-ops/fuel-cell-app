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
  data: {
    snapshot: ReportSnapshot;
    aiReview: string | null;
    createdAt: string;
    title: string | null;
  };
};
export type ReportListItem = {
  id: string;
  title: string | null;
  createdAt: string;
  totalCapacity_kW: number;
  paybackYears: number | null;
  npv20_원: number | null;
  irr20: number | null;
};

const TITLE_MAX = 80;
function sanitizeTitle(t: string | null | undefined): string | null {
  if (t == null) return null;
  const trimmed = t.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, TITLE_MAX);
}
type ListOk = { ok: true; data: ReportListItem[] };
type Err = { ok: false; error: string };

export async function saveReport(
  clientId: string,
  raw: unknown,
  title?: string | null,
): Promise<SaveOk | Err> {
  if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
  const parsed = reportSnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: '리포트 스냅샷 검증 실패: ' + parsed.error.issues[0]?.message };
  }

  const id = randomUUID();
  const { error } = await supabaseServer.from('reports').insert({
    id,
    client_id: clientId,
    payload: parsed.data,
    title: sanitizeTitle(title),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}

export async function renameReport(
  id: string,
  clientId: string,
  title: string,
): Promise<{ ok: true; title: string | null } | Err> {
  if (!id || !clientId) return { ok: false, error: 'id/clientId가 필요합니다.' };
  const next = sanitizeTitle(title);
  const { error } = await supabaseServer
    .from('reports')
    .update({ title: next })
    .eq('id', id)
    .eq('client_id', clientId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, title: next };
}

export async function loadReport(id: string): Promise<LoadOk | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const supabase = supabaseServer;
  const { data, error } = await supabase
    .from('reports')
    .select('payload, ai_review, created_at, title')
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
      title: data.title ?? null,
    },
  };
}

export async function listReports(clientId: string): Promise<ListOk | Err> {
  if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
  const supabase = supabaseServer;
  const { data, error } = await supabase
    .from('reports')
    .select('id, payload, created_at, title')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: error.message };

  const items: ReportListItem[] = (data ?? []).map((row) => {
    const p = row.payload as ReportSnapshot;
    const s20 = p.results.economics.summary.데이터.find((r) => r.기간_년 === 20);
    return {
      id: row.id,
      title: row.title ?? null,
      createdAt: row.created_at,
      totalCapacity_kW: p.inputs.fuelCell.총설치용량_kW ?? 0,
      paybackYears: p.results.paybackYears,
      npv20_원: s20?.NPV_원 ?? null,
      irr20: s20?.IRR ?? null,
    };
  });
  return { ok: true, data: items };
}

export async function deleteReport(id: string, clientId: string): Promise<{ ok: true } | Err> {
  if (!id || !clientId) return { ok: false, error: 'id/clientId가 필요합니다.' };
  const { error } = await supabaseServer
    .from('reports')
    .delete()
    .eq('id', id)
    .eq('client_id', clientId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function saveAiReview(id: string, review: string): Promise<{ ok: true } | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const supabase = supabaseServer;
  const { error } = await supabase.from('reports').update({ ai_review: review }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
