import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AllLibraries } from '../loadLibraries';

// Supabase server 모듈 모킹 (server-only 환경 우회)
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));
vi.mock('server-only', () => ({}));

import { supabaseServer } from '@/lib/supabase/server';

// 테스트용 픽스처 데이터
const fuelCellRows = [
  {
    id: 1,
    type: 'PEMFC',
    manufacturer: '범한퓨얼셀',
    model_name: 'BNH050',
    rated_power_kw: 5,
    heat_output_kw: 8,
    gas_input_kw: 13.6,
    electric_efficiency: 0.357,
    heat_recovery_efficiency: 0.5242,
    install_cost_per_kw: 10000000,
    om_cost_per_kw_year: 2200000,
  },
  {
    id: 2,
    type: 'SOFC',
    manufacturer: '미코파워',
    model_name: 'TUCY8KN2100',
    rated_power_kw: 8,
    heat_output_kw: 7.1,
    gas_input_kw: 12.9,
    electric_efficiency: 0.617,
    heat_recovery_efficiency: 0.4,
    install_cost_per_kw: 20000000,
    om_cost_per_kw_year: 2200000,
  },
];

const operationRows = [
  {
    id: 1,
    name: '365일가동',
    annual_days: 365,
    monthly_days: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  },
  {
    id: 2,
    name: '주말일부가동',
    annual_days: 300,
    monthly_days: [26, 23, 25, 26, 26, 24, 26, 26, 22, 25, 26, 25],
  },
  {
    id: 3,
    name: '평일가동',
    annual_days: 250,
    monthly_days: [22, 19, 21, 22, 22, 20, 22, 21, 18, 21, 21, 21],
  },
  {
    id: 4,
    name: '학기중가동',
    annual_days: 200,
    monthly_days: [0, 14, 23, 22, 21, 22, 15, 3, 22, 21, 22, 15],
  },
];

const electricityPlanRows = [
  {
    id: 1,
    plan_name: '일반용(을) 고압A 선택Ⅱ',
    base_charge_per_kw: 8320,
    unit: '원/kWh',
    is_active: true,
    electricity_tariff_monthly: [
      { month: 1, off_peak: 94.3, mid_peak: 140.4, on_peak: 197.9 },
      { month: 2, off_peak: 94.3, mid_peak: 140.4, on_peak: 197.9 },
      { month: 3, off_peak: 87.3, mid_peak: 109.8, on_peak: 140.5 },
      { month: 4, off_peak: 87.3, mid_peak: 109.8, on_peak: 140.5 },
      { month: 5, off_peak: 87.3, mid_peak: 109.8, on_peak: 140.5 },
      { month: 6, off_peak: 87.3, mid_peak: 140.2, on_peak: 222.3 },
      { month: 7, off_peak: 87.3, mid_peak: 140.2, on_peak: 222.3 },
      { month: 8, off_peak: 87.3, mid_peak: 140.2, on_peak: 222.3 },
      { month: 9, off_peak: 87.3, mid_peak: 109.8, on_peak: 140.5 },
      { month: 10, off_peak: 87.3, mid_peak: 109.8, on_peak: 140.5 },
      { month: 11, off_peak: 94.3, mid_peak: 140.4, on_peak: 197.9 },
      { month: 12, off_peak: 94.3, mid_peak: 140.4, on_peak: 197.9 },
    ],
  },
];

const gasRows = [
  { id: 1, name: '연료전지전용', unit_price_per_kwh: 4.01154 },
  { id: 2, name: '일반용(영업1) 도시가스 요금', unit_price_per_kwh: 5.3072 },
];

beforeEach(() => {
  vi.clearAllMocks();

  const fromMock = vi.mocked(supabaseServer.from);
  fromMock.mockImplementation((table: string) => {
    if (table === 'fuel_cell_products') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: fuelCellRows, error: null }),
      } as unknown as ReturnType<typeof supabaseServer.from>;
    }
    if (table === 'operation_profiles') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: operationRows, error: null }),
      } as unknown as ReturnType<typeof supabaseServer.from>;
    }
    if (table === 'electricity_tariff_plans') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: electricityPlanRows, error: null }),
      } as unknown as ReturnType<typeof supabaseServer.from>;
    }
    if (table === 'gas_tariffs') {
      return {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: gasRows, error: null }),
      } as unknown as ReturnType<typeof supabaseServer.from>;
    }
    throw new Error(`Unexpected table: ${table}`);
  });
});

describe('library loaders', () => {
  it('fuel cell library passes schema and contains expected types', async () => {
    const { loadFuelCellLibrary } = await import('../loadLibraries');
    const lib = await loadFuelCellLibrary();
    expect(lib.length).toBeGreaterThan(0);
    const types = new Set(lib.map((p) => p.형식));
    expect(types.has('PEMFC')).toBe(true);
    expect(types.has('SOFC')).toBe(true);
  });

  it('operation library has all 4 profile keys with 12 monthly entries', async () => {
    const { loadOperationLibrary } = await import('../loadLibraries');
    const lib = await loadOperationLibrary();
    const keys = ['365일가동', '주말일부가동', '평일가동', '학기중가동'] as const;
    for (const k of keys) {
      expect(lib[k]).toBeDefined();
      expect(lib[k]?.월별가동일).toHaveLength(12);
    }
    expect(lib['365일가동']?.연간가동일).toBe(365);
  });

  it('electricity tariffs returns array; first plan has 12 monthly rows', async () => {
    const { loadElectricityTariffs } = await import('../loadLibraries');
    const plans = await loadElectricityTariffs();
    expect(plans.length).toBeGreaterThan(0);
    const first = plans[0]!;
    expect(first.데이터).toHaveLength(12);
    const months = first.데이터.map((r) => r.월).sort((a, b) => a - b);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(first.기본요금_원per_kW).toBeGreaterThan(0);
    expect(typeof first.is_active).toBe('boolean');
  });

  it('gas tariff library is non-empty array', async () => {
    const { loadGasTariff } = await import('../loadLibraries');
    const lib = await loadGasTariff();
    expect(lib.length).toBeGreaterThan(0);
    expect(lib[0]?.단가_원per_kW).toBeGreaterThan(0);
  });

  it('loadAllLibraries returns all 4 libraries; electricity is an array', async () => {
    const { loadAllLibraries } = await import('../loadLibraries');
    const all: AllLibraries = await loadAllLibraries();
    expect(all.fuelCell).toBeDefined();
    expect(all.operation).toBeDefined();
    expect(Array.isArray(all.electricity)).toBe(true);
    expect(all.electricity.length).toBeGreaterThan(0);
    expect(all.gas).toBeDefined();
  });
});
