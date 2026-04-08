/**
 * Phase 3b — 수익 계산 (순수 함수).
 *
 * 산식 (Phase 3 §3b 확정):
 *   발전수익  = 중간부하kWh × 전기[중간부하] + 최대부하kWh × 전기[최대부하]
 *              + 계약용량_kW × 기본요금_원per_kW   (매월 절감 가산)
 *   열수익    = 열생산kWh × 가스[일반용] / 보일러효율
 *   가스사용  = 가스사용kWh × 가스[연료전지전용]
 *   최종수익  = 발전수익 + 열수익 − 가스사용요금
 *
 * 보일러효율 기본값 0.85, 사용자 수정 가능.
 * 가스 단가는 라이브러리에서 구분 문자열로 룩업:
 *   - 연료전지전용  → 가스사용요금 산정
 *   - 일반용(영업1) → 열 대체 가치 산정 (substring 매칭)
 */
import type { z } from 'zod';
import type { electricityTariffLibrarySchema, gasTariffLibrarySchema } from '@/lib/schemas/library';
import type {
  EnergyProductionOutput,
  EnergyRevenueOutput,
  EnergyRevenueRow,
} from '@/types/outputs';

type ElectricityTariff = z.infer<typeof electricityTariffLibrarySchema>;
type GasTariff = z.infer<typeof gasTariffLibrarySchema>;

export interface CalcRevenueParams {
  production: EnergyProductionOutput;
  electricityTariff: ElectricityTariff;
  gasTariff: GasTariff;
  /** 가스보일러 효율 (열수익 환산용). 기본 0.85. */
  boilerEfficiency?: number;
}

export const DEFAULT_BOILER_EFFICIENCY = 0.85;
export const GAS_TARIFF_FUELCELL = '연료전지전용';
export const GAS_TARIFF_GENERAL = '일반용';

export function lookupGasUnitPrice(library: GasTariff, match: string): number | null {
  const entry = library.find((g) => g.구분.includes(match));
  return entry ? entry.단가_원per_kW : null;
}

export function calcEnergyRevenue(params: CalcRevenueParams): EnergyRevenueOutput {
  const {
    production,
    electricityTariff,
    gasTariff,
    boilerEfficiency = DEFAULT_BOILER_EFFICIENCY,
  } = params;

  const fuelCellGasPrice = lookupGasUnitPrice(gasTariff, GAS_TARIFF_FUELCELL);
  const generalGasPrice = lookupGasUnitPrice(gasTariff, GAS_TARIFF_GENERAL);
  const baseChargePerKW = electricityTariff.기본요금_원per_kW;

  const rows: EnergyRevenueRow[] = production.데이터.map((p) => {
    const tariffRow = electricityTariff.데이터.find((t) => t.월 === p.월);

    // 발전수익
    let 발전수익: number | null = null;
    if (
      tariffRow &&
      p.월간_중간부하시간_전력생산량_kWh != null &&
      p.월간_최대부하시간_전력생산량_kWh != null &&
      p.계약용량_kW != null
    ) {
      발전수익 =
        p.월간_중간부하시간_전력생산량_kWh * tariffRow.중간부하 +
        p.월간_최대부하시간_전력생산량_kWh * tariffRow.최대부하 +
        p.계약용량_kW * baseChargePerKW;
    }

    // 열수익 (열로 대체된 가스보일러 연료비)
    let 열수익: number | null = null;
    if (p.월간_연료전지_열생산량_kWh != null && generalGasPrice != null && boilerEfficiency > 0) {
      열수익 = (p.월간_연료전지_열생산량_kWh * generalGasPrice) / boilerEfficiency;
    }

    // 가스사용요금
    let 가스요금: number | null = null;
    if (p.월간_도시가스사용량_kWh != null && fuelCellGasPrice != null) {
      가스요금 = p.월간_도시가스사용량_kWh * fuelCellGasPrice;
    }

    // 최종수익
    let 최종: number | null = null;
    if (발전수익 != null && 열수익 != null && 가스요금 != null) {
      최종 = 발전수익 + 열수익 - 가스요금;
    }

    return {
      월: p.월,
      일수: p.일수,
      발전_월간총수익_원: 발전수익,
      열생산_월간총수익_원: 열수익,
      도시가스사용요금_원: 가스요금,
      에너지생산_최종수익_원: 최종,
    };
  });

  return {
    columns: [
      '월',
      '일수',
      '발전_월간총수익_원',
      '열생산_월간총수익_원',
      '도시가스사용요금_원',
      '에너지생산_최종수익_원',
    ],
    데이터: rows,
    합계: sumRows(rows),
  };
}

function sumRows(rows: EnergyRevenueRow[]): EnergyRevenueOutput['합계'] {
  const sum = (key: keyof EnergyRevenueRow): number | null => {
    let acc: number | null = null;
    for (const r of rows) {
      const v = r[key];
      if (typeof v !== 'number') continue;
      acc = (acc ?? 0) + v;
    }
    return acc;
  };
  return {
    일수: sum('일수'),
    발전_월간총수익_원: sum('발전_월간총수익_원'),
    열생산_월간총수익_원: sum('열생산_월간총수익_원'),
    도시가스사용요금_원: sum('도시가스사용요금_원'),
    에너지생산_최종수익_원: sum('에너지생산_최종수익_원'),
  };
}
