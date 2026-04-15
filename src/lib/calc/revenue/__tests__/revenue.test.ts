import { describe, it, expect } from 'vitest';
import { calcEnergyRevenue, DEFAULT_BOILER_EFFICIENCY } from '../revenue';
import type { z } from 'zod';
import type { electricityTariffLibrarySchema, gasTariffLibrarySchema } from '@/lib/schemas/library';
import type { EnergyProductionOutput } from '@/types/outputs';

const elecTariff: z.infer<typeof electricityTariffLibrarySchema> = {
  요금제: '일반용(을) 고압A 선택Ⅱ',
  기본요금_원per_kW: 8320,
  단위: '원/kWh',
  is_active: true,
  데이터: [
    { 월: 1, 경부하: 94.3, 중간부하: 140.4, 최대부하: 197.9 },
    { 월: 2, 경부하: 94.3, 중간부하: 140.4, 최대부하: 197.9 },
    { 월: 3, 경부하: 87.3, 중간부하: 109.8, 최대부하: 140.5 },
    { 월: 4, 경부하: 87.3, 중간부하: 109.8, 최대부하: 140.5 },
    { 월: 5, 경부하: 87.3, 중간부하: 109.8, 최대부하: 140.5 },
    { 월: 6, 경부하: 87.3, 중간부하: 140.2, 최대부하: 222.3 },
    { 월: 7, 경부하: 87.3, 중간부하: 140.2, 최대부하: 222.3 },
    { 월: 8, 경부하: 87.3, 중간부하: 140.2, 최대부하: 222.3 },
    { 월: 9, 경부하: 87.3, 중간부하: 109.8, 최대부하: 140.5 },
    { 월: 10, 경부하: 87.3, 중간부하: 109.8, 최대부하: 140.5 },
    { 월: 11, 경부하: 94.3, 중간부하: 140.4, 최대부하: 197.9 },
    { 월: 12, 경부하: 94.3, 중간부하: 140.4, 최대부하: 197.9 },
  ],
};

const gasTariff: z.infer<typeof gasTariffLibrarySchema> = [
  { 구분: '연료전지전용', 단가_원per_kW: 4.01154 },
  { 구분: '일반용(영업1) 도시가스 요금', 단가_원per_kW: 5.3072 },
];

function makeProduction(): EnergyProductionOutput {
  // 1월: 31일, 5kW 1대, 16h중간 + 8h최대
  // 중간부하발전 = 5×16×31 = 2480 kWh
  // 최대부하발전 = 5×8×31  = 1240 kWh
  // 열생산        = 8×24×31 = 5952 kWh
  // 가스사용      = 13.6×24×31 ≈ 10118.4 kWh
  return {
    columns: [],
    데이터: Array.from({ length: 12 }, (_, i) => ({
      월: i + 1,
      일수: 31,
      계약용량_kW: 5,
      월간_중간부하시간_전력생산량_kWh: 2480,
      월간_최대부하시간_전력생산량_kWh: 1240,
      월간_연료전지_열생산량_kWh: 5952,
      월간_도시가스사용량_kWh: 10118.4,
    })),
    합계: {
      일수: 372,
      계약용량_kW: 5,
      월간_중간부하시간_전력생산량_kWh: 2480 * 12,
      월간_최대부하시간_전력생산량_kWh: 1240 * 12,
      월간_연료전지_열생산량_kWh: 5952 * 12,
      월간_도시가스사용량_kWh: 10118.4 * 12,
    },
  };
}

describe('calcEnergyRevenue', () => {
  it('1월 발전수익 — 손계산 일치 (중간부하 + 최대부하 + 기본요금)', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
    });
    const jan = out.데이터[0];
    const expected = 2480 * 140.4 + 1240 * 197.9 + 5 * 8320;
    expect(jan.발전_월간총수익_원).toBeCloseTo(expected, 4);
  });

  it('1월 열수익 = 열kWh × 일반가스단가 / 보일러효율(0.85)', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
    });
    const expected = (5952 * 5.3072) / DEFAULT_BOILER_EFFICIENCY;
    expect(out.데이터[0].열생산_월간총수익_원).toBeCloseTo(expected, 4);
  });

  it('1월 도시가스사용요금 = 가스kWh × 연료전지전용 단가', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
    });
    const expected = 10118.4 * 4.01154;
    expect(out.데이터[0].도시가스사용요금_원).toBeCloseTo(expected, 4);
  });

  it('최종수익 = 발전 + 열 − 가스, 그리고 합계 일치', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
    });
    const jan = out.데이터[0];
    expect(jan.에너지생산_최종수익_원).toBeCloseTo(
      (jan.발전_월간총수익_원 ?? 0) +
        (jan.열생산_월간총수익_원 ?? 0) -
        (jan.도시가스사용요금_원 ?? 0),
      4,
    );
    // 합계 = 각 월 row 합 (월별 단가 다름)
    const expectedTotal = out.데이터.reduce((s, r) => s + (r.에너지생산_최종수익_원 ?? 0), 0);
    expect(out.합계.에너지생산_최종수익_원).toBeCloseTo(expectedTotal, 4);
  });

  it('보일러효율 override (1.0) 시 열수익 변경', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
      boilerEfficiency: 1.0,
    });
    expect(out.데이터[0].열생산_월간총수익_원).toBeCloseTo(5952 * 5.3072, 4);
  });

  it('production이 null이면 해당 row의 수익도 null', () => {
    const prod = makeProduction();
    prod.데이터[0] = {
      ...prod.데이터[0],
      월간_중간부하시간_전력생산량_kWh: null,
      월간_최대부하시간_전력생산량_kWh: null,
      월간_연료전지_열생산량_kWh: null,
      월간_도시가스사용량_kWh: null,
      계약용량_kW: null,
    };
    const out = calcEnergyRevenue({
      production: prod,
      electricityTariff: elecTariff,
      gasTariff,
    });
    expect(out.데이터[0].발전_월간총수익_원).toBeNull();
    expect(out.데이터[0].열생산_월간총수익_원).toBeNull();
    expect(out.데이터[0].도시가스사용요금_원).toBeNull();
    expect(out.데이터[0].에너지생산_최종수익_원).toBeNull();
  });

  it('6월(여름 최대부하 222.3) 단가 다르게 적용', () => {
    const out = calcEnergyRevenue({
      production: makeProduction(),
      electricityTariff: elecTariff,
      gasTariff,
    });
    const jun = out.데이터[5];
    const expected = 2480 * 140.2 + 1240 * 222.3 + 5 * 8320;
    expect(jun.발전_월간총수익_원).toBeCloseTo(expected, 4);
  });
});
