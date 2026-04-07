import { describe, it, expect, beforeEach, vi } from 'vitest';

// ------------------------------------------------------------
// Supabase 서버 클라이언트 모킹
// ------------------------------------------------------------
// from(table) → 체이너블 객체. 마지막 메서드(single/maybeSingle)에서 결과 반환.
// 테스트마다 mockState를 갈아끼워 동작을 제어한다.

type MockResult = { data: unknown; error: { message: string } | null };
const mockState: {
  insertResult: MockResult;
  selectResults: Record<string, MockResult>; // table → result
  capturedInserts: { table: string; row: unknown }[];
} = {
  insertResult: { data: { id: 'row-1' }, error: null },
  selectResults: {},
  capturedInserts: [],
};

function makeBuilder(table: string) {
  const builder: Record<string, unknown> = {
    insert(row: unknown) {
      mockState.capturedInserts.push({ table, row });
      return builder;
    },
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    single() {
      return Promise.resolve(mockState.insertResult);
    },
    maybeSingle() {
      return Promise.resolve(mockState.selectResults[table] ?? { data: null, error: null });
    },
  };
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: (table: string) => makeBuilder(table),
  },
}));

// 모듈 import는 mock 이후
import { saveFuelCellInput, saveOperationInput, loadLatestInputs } from '../inputs';

beforeEach(() => {
  mockState.insertResult = { data: { id: 'row-1' }, error: null };
  mockState.selectResults = {};
  mockState.capturedInserts = [];
});

const validFuelCell = {
  sets: [
    {
      set_id: 's1',
      형식: 'PEMFC',
      제조사: 'A',
      모델: 'M1',
      발전용량_kW: 10,
      열생산용량_kW: 5,
      설치수량: 1,
    },
  ],
  총설치용량_kW: 10,
};

const validOperation = {
  연간운전유형: '365일가동',
  연간운전일수: 365,
  일일_중간부하_운전시간: 10,
  일일_최대부하_운전시간: 8,
};

describe('saveFuelCellInput', () => {
  it('빈 clientId 거부', async () => {
    const r = await saveFuelCellInput('', validFuelCell);
    expect(r.ok).toBe(false);
  });

  it('스키마 위반 시 ok:false', async () => {
    const r = await saveFuelCellInput('client-1', { sets: 'oops' });
    expect(r.ok).toBe(false);
  });

  it('정상 입력 시 insert 호출 및 id 반환', async () => {
    const r = await saveFuelCellInput('client-1', validFuelCell);
    expect(r).toEqual({ ok: true, data: { id: 'row-1' } });
    expect(mockState.capturedInserts).toHaveLength(1);
    expect(mockState.capturedInserts[0].table).toBe('fuel_cell_inputs');
    expect(mockState.capturedInserts[0].row).toMatchObject({
      client_id: 'client-1',
    });
  });

  it('Supabase 에러 전파', async () => {
    mockState.insertResult = { data: null, error: { message: 'db down' } };
    const r = await saveFuelCellInput('client-1', validFuelCell);
    expect(r).toEqual({ ok: false, error: 'db down' });
  });
});

describe('saveOperationInput', () => {
  it('정상 입력 시 operation_inputs 테이블에 insert', async () => {
    const r = await saveOperationInput('client-1', validOperation);
    expect(r.ok).toBe(true);
    expect(mockState.capturedInserts[0].table).toBe('operation_inputs');
  });

  it('합계 24h 초과 시 거부', async () => {
    const r = await saveOperationInput('client-1', {
      ...validOperation,
      일일_중간부하_운전시간: 20,
      일일_최대부하_운전시간: 10,
    });
    expect(r.ok).toBe(false);
  });
});

describe('loadLatestInputs', () => {
  it('데이터 없음 → 양쪽 null', async () => {
    const r = await loadLatestInputs('client-1');
    expect(r).toEqual({ ok: true, data: { fuelCell: null, operation: null } });
  });

  it('두 테이블에서 최신 row 반환', async () => {
    mockState.selectResults = {
      fuel_cell_inputs: { data: { payload: validFuelCell }, error: null },
      operation_inputs: { data: { payload: validOperation }, error: null },
    };
    const r = await loadLatestInputs('client-1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.fuelCell?.총설치용량_kW).toBe(10);
      expect(r.data.operation?.연간운전일수).toBe(365);
    }
  });

  it('스키마와 맞지 않는 과거 payload는 null로 처리', async () => {
    mockState.selectResults = {
      fuel_cell_inputs: { data: { payload: { broken: true } }, error: null },
      operation_inputs: { data: null, error: null },
    };
    const r = await loadLatestInputs('client-1');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.fuelCell).toBeNull();
  });

  it('Supabase 에러 전파', async () => {
    mockState.selectResults = {
      fuel_cell_inputs: { data: null, error: { message: 'oops' } },
    };
    const r = await loadLatestInputs('client-1');
    expect(r).toEqual({ ok: false, error: 'oops' });
  });
});
