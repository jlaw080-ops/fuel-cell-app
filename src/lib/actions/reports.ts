'use server';

/**
 * Phase 5a — 리포트 스냅샷 Server Actions.
 *
 * saveReport(clientId, snapshot) → { ok, id } | { ok:false, error }
 * loadReport(id)               → { ok, data } | { ok:false, error }
 */
import { randomUUID } from 'crypto';
import { supabaseServer } from '@/lib/supabase/server';
import { createSupabaseServerClient } from '@/lib/supabase/serverWithAuth';
import { reportSnapshotSchema, type ReportSnapshot } from '@/lib/schemas/report';

/**
 * Phase 6e-2 — 현재 세션 사용자를 반환. 로그인 상태면 cookie 기반
 * authenticated 클라이언트와 userId를, 아니면 익명 클라이언트만 반환.
 */
async function getAuthedClient() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { supabase, userId: user.id as string };
  return { supabase: supabaseServer, userId: null as string | null };
}

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
  const { supabase, userId } = await getAuthedClient();
  const { error } = await supabase.from('reports').insert({
    id,
    client_id: clientId,
    payload: parsed.data,
    title: sanitizeTitle(title),
    user_id: userId, // null 이면 anon 정책, 값이 있으면 authenticated 정책
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id };
}

export async function renameReport(
  id: string,
  clientId: string,
  title: string,
): Promise<{ ok: true; title: string | null } | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const next = sanitizeTitle(title);
  const { supabase, userId } = await getAuthedClient();
  let q = supabase.from('reports').update({ title: next }).eq('id', id);
  if (!userId) {
    if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
    q = q.eq('client_id', clientId);
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, title: next };
}

export async function loadReport(id: string): Promise<LoadOk | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const { supabase } = await getAuthedClient();
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
  const { supabase, userId } = await getAuthedClient();
  // 로그인 시: RLS가 user_id = auth.uid() 로 자동 필터 (client_id 무시)
  // 비로그인 시: 기존 client_id 기반 필터
  let query = supabase
    .from('reports')
    .select('id, payload, created_at, title')
    .order('created_at', { ascending: false })
    .limit(100);
  if (!userId) {
    if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
    query = query.eq('client_id', clientId);
  }
  const { data, error } = await query;
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
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const { supabase, userId } = await getAuthedClient();
  let q = supabase.from('reports').delete().eq('id', id);
  if (!userId) {
    if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
    q = q.eq('client_id', clientId);
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Phase 6e-2 — 첫 로그인 직후 호출. 이 브라우저(clientId)가 anon 상태에서
 * 저장했던 리포트를 현재 로그인 사용자 계정으로 이전한다.
 *
 * 사용 정책: `auth_claim_anon` (마이그레이션 20260409000001) —
 *   USING (user_id is null) WITH CHECK (user_id = auth.uid())
 *
 * 필터: client_id 는 브라우저 localStorage 에 있는 UUID 라 타 사용자가
 * 추측하기 어렵지만, 서버에서도 명시적으로 제한한다.
 */
export async function claimAnonReports(
  clientId: string,
): Promise<{ ok: true; claimed: number } | Err> {
  if (!clientId) return { ok: false, error: 'clientId가 필요합니다.' };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: '로그인이 필요합니다.' };

  const { data, error } = await supabase
    .from('reports')
    .update({ user_id: user.id })
    .is('user_id', null)
    .eq('client_id', clientId)
    .select('id');
  if (error) return { ok: false, error: error.message };
  return { ok: true, claimed: (data ?? []).length };
}

export async function saveAiReview(id: string, review: string): Promise<{ ok: true } | Err> {
  if (!id) return { ok: false, error: 'id가 필요합니다.' };
  const { supabase } = await getAuthedClient();
  const { error } = await supabase.from('reports').update({ ai_review: review }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
