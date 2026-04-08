import { describe, it, expect } from 'vitest';
import {
  calcEconomics,
  calcCapex,
  calcFixedMaintenance,
  npv,
  irr,
  calcPaybackYears,
} from '../economics';
import type { z } from 'zod';
import type { fuelCellLibrarySchema } from '@/lib/schemas/library';
import type { EnergyProductionOutput, EnergyRevenueOutput } from '@/types/outputs';

const library: z.infer<typeof fuelCellLibrarySchema> = [
  {
    형식: 'PEMFC',
    제조사: '범한퓨얼셀',
    모델명: 'BNH050',
    정격발전용량_kW: 5,
    열생산용량_kW: 8,
    가스소비량_kW: 13.6,
    발전효율: 0.357,
    열회수효율: 0.5242,
    kW당설치단가: 10_000_000,
    kW당연간유지비용: 2_200_000,
  },
];

const fuelCell = {
  sets: [
    {
      set_id: 's1',
      형식: 'PEMFC' as const,
      제조사: '범한퓨얼셀',
      모델: 'BNH050',
      발전용량_kW: 5,
      열생산용량_kW: 8,
      설치수량: 1,
    },
  ],
  총설치용량_kW: 5,
};

function makeProduction(): EnergyProductionOutput {
  // 임의로 단순화: 연간 전력 = 36500 kWh, 열 = 70080, 가스 = 119188.8
  return {
    columns: [],
    데이터: [],
    합계: {
      일수: 365,
      계약용량_kW: 5,
      월간_중간부하시간_전력생산량_kWh: 24333.33,
      월간_최대부하시간_전력생산량_kWh: 12166.67,
      월간_연료전지_열생산량_kWh: 70080,
      월간_도시가스사용량_kWh: 119188.8,
    },
  };
}

function makeRevenue(): EnergyRevenueOutput {
  return {
    columns: [],
    데이터: [],
    합계: {
      일수: 365,
      발전_월간총수익_원: 6_000_000,
      열생산_월간총수익_원: 437_000,
      도시가스사용요금_원: 478_000,
      에너지생산_최종수익_원: 5_959_000,
    },
  };
}

describe('calcCapex / calcFixedMaintenance', () => {
  it('CAPEX = 5kW × 1 × 1000만원 = 5천만', () => {
    expect(calcCapex(fuelCell, library)).toBe(50_000_000);
  });
  it('연간유지비 = 5 × 220만 = 1100만', () => {
    expect(calcFixedMaintenance(fuelCell, library)).toBe(11_000_000);
  });
  it('라이브러리 단가 null이면 null', () => {
    const lib2 = [{ ...library[0], kW당설치단가: null }];
    expect(calcCapex(fuelCell, lib2)).toBeNull();
  });
});

describe('npv / irr', () => {
  it('npv 0% 할인 = 단순합', () => {
    expect(npv(0, [-100, 50, 60, 70])).toBeCloseTo(80, 6);
  });
  it('npv 10% 할인 — 표준 산식', () => {
    // -100 + 50/1.1 + 60/1.21 + 70/1.331
    const expected = -100 + 50 / 1.1 + 60 / 1.21 + 70 / 1.331;
    expect(npv(0.1, [-100, 50, 60, 70])).toBeCloseTo(expected, 6);
  });
  it('irr — NPV(irr) = 0', () => {
    const cf = [-1000, 300, 400, 500, 200];
    const r = irr(cf);
    expect(r).not.toBeNull();
    expect(npv(r as number, cf)).toBeCloseTo(0, 4);
  });
});

describe('calcEconomics', () => {
  it('20년 기본 — annual rows = 21 (0..20), CAPEX 적용', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    expect(out.capex).toBe(50_000_000);
    expect(out.baseAnnualMaintenance).toBe(11_000_000);
    expect(out.annual.데이터.length).toBe(21);
    expect(out.annual.데이터[0].연도).toBe(0);
    expect(out.annual.데이터[0].순현금흐름_원).toBe(-50_000_000);
    expect(out.annual.데이터[20].연도).toBe(20);
  });

  it('상승률 0% — 1년차 순현금 = (발전+열-가스) - 유지', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    const y1 = out.annual.데이터[1];
    const expectedNet = 6_000_000 + 437_000 - 478_000 - 11_000_000;
    expect(y1.순현금흐름_원).toBeCloseTo(expectedNet, 4);
    expect(y1.총수익_원).toBeCloseTo(6_000_000 + 437_000 - 478_000, 4);
    expect(y1.유지보수비용_원).toBeCloseTo(11_000_000, 4);
  });

  it('전기상승률 5% 적용 — 1년차 baseline, 2년차 ×1.05', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
      electricityEscalation: 0.05,
    });
    const y1Elec = 6_000_000;
    const y2Elec = 6_000_000 * 1.05;
    const y1Total = out.annual.데이터[1].총수익_원 ?? 0;
    const y2Total = out.annual.데이터[2].총수익_원 ?? 0;
    expect(y2Total - y1Total).toBeCloseTo(y2Elec - y1Elec, 4);
  });

  it('maintenanceMode=ratio: CAPEX × 8%', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
      maintenanceMode: 'ratio',
    });
    expect(out.baseAnnualMaintenance).toBe(50_000_000 * 0.08);
  });

  it('LCOE > 0 (전기 분모만)', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    expect(out.lcoe_원per_kWh).not.toBeNull();
    expect(out.lcoe_원per_kWh!).toBeGreaterThan(0);
  });

  it('Summary 4개 기간 (5/10/15/20), CAPEX 일치', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    expect(out.summary.데이터.map((r) => r.기간_년)).toEqual([5, 10, 15, 20]);
    for (const r of out.summary.데이터) {
      expect(r['초기투자비용(설치비)_원']).toBe(50_000_000);
      expect(r.NPV_원).not.toBeNull();
    }
  });

  it('회수기간 — 누적순현금흐름이 0을 넘는 연도', () => {
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: library,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    // base net ≈ -5,041,000/year → never recovers in 20yrs
    const pb = calcPaybackYears(out.annual);
    expect(pb).toBeNull();
  });

  it('CAPEX null이면 모든 연도 row null', () => {
    const lib2 = [{ ...library[0], kW당설치단가: null }];
    const out = calcEconomics({
      fuelCell,
      fuelCellLibrary: lib2,
      production: makeProduction(),
      revenue: makeRevenue(),
    });
    expect(out.capex).toBeNull();
    expect(out.annual.데이터[0].순현금흐름_원).toBeNull();
    expect(out.annual.데이터[20].순현금흐름_원).toBeNull();
    expect(out.lcoe_원per_kWh).toBeNull();
  });
});
