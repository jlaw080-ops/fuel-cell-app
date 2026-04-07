/**
 * 입력(Input1, Input2) 저장/로드 Server Actions.
 *
 * - 'use server' 디렉티브로 모든 export가 Server Function이 된다.
 * - Server Function은 직접 POST 호출이 가능하므로 내부 zod 검증 필수.
 * - 캐싱은 적용하지 않는다(Phase 2 결정 — clientId별 데이터로 캐시 효용 낮음).
 *   따라서 updateTag 호출도 생략. 클라이언트는 저장 후 loadLatestInputs를
 *   다시 호출하여 최신 상태를 가져온다.
 * - 반환은 throw 대신 { ok, data } | { ok, error } 형태로 통일하여
 *   useActionState 친화적으로 만든다.
 */
'use server';

import { supabaseServer } from '@/lib/supabase/server';
import {
  fuelCellInputSchema,
  operationInputSchema,
  type FuelCellInputParsed,
  type OperationInputParsed,
} from '@/lib/schemas/inputs';

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const FUEL_CELL_TABLE = 'fuel_cell_inputs';
const OPERATION_TABLE = 'operation_inputs';

function ensureClientId(clientId: string): string | null {
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return 'clientId가 비어 있습니다.';
  }
  return null;
}

// ============================================================
// 저장
// ============================================================

export async function saveFuelCellInput(
  clientId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const idErr = ensureClientId(clientId);
  if (idErr) return { ok: false, error: idErr };

  const parsed = fuelCellInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력 검증 실패' };
  }

  const { data, error } = await supabaseServer
    .from(FUEL_CELL_TABLE)
    .insert({ client_id: clientId, payload: parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id as string } };
}

export async function saveOperationInput(
  clientId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const idErr = ensureClientId(clientId);
  if (idErr) return { ok: false, error: idErr };

  const parsed = operationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? '입력 검증 실패' };
  }

  const { data, error } = await supabaseServer
    .from(OPERATION_TABLE)
    .insert({ client_id: clientId, payload: parsed.data })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { id: data.id as string } };
}

// ============================================================
// 로드 (캐싱 없음 — 매 호출 fresh fetch)
// ============================================================

export type LatestInputs = {
  fuelCell: FuelCellInputParsed | null;
  operation: OperationInputParsed | null;
};

export async function loadLatestInputs(clientId: string): Promise<ActionResult<LatestInputs>> {
  const idErr = ensureClientId(clientId);
  if (idErr) return { ok: false, error: idErr };

  const [fcRes, opRes] = await Promise.all([
    supabaseServer
      .from(FUEL_CELL_TABLE)
      .select('payload')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseServer
      .from(OPERATION_TABLE)
      .select('payload')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (fcRes.error) return { ok: false, error: fcRes.error.message };
  if (opRes.error) return { ok: false, error: opRes.error.message };

  // 저장된 payload를 zod로 다시 파싱하여 타입 안전성 확보.
  // 스키마 변경으로 과거 데이터가 깨질 수 있으므로 실패 시 null 반환.
  const fuelCell = fcRes.data
    ? (fuelCellInputSchema.safeParse(fcRes.data.payload).data ?? null)
    : null;
  const operation = opRes.data
    ? (operationInputSchema.safeParse(opRes.data.payload).data ?? null)
    : null;

  return { ok: true, data: { fuelCell, operation } };
}
