/**
 * Phase 3a — 에너지 산출 계산 (순수 함수).
 *
 * 입력:
 *   - sets: 사용자 선택 연료전지 세트 (모델명 + 수량)
 *   - op: 운전 프로파일 (운전유형 + 일일 중간/최대 운전시간)
 *   - fuelCellLibrary: 라이브러리(가스소비량_kW 룩업용)
 *   - operationLibrary: 월별 가동일 룩업
 *
 * 산식 (Phase 3 계획서 §3a 확정):
 *   계약용량_kW         = Σ(세트.발전용량_kW × 수량)
 *   월간_중간부하_kWh   = 계약용량 × 일일중간h × 월별가동일
 *   월간_최대부하_kWh   = 계약용량 × 일일최대h × 월별가동일
 *   월간_열생산_kWh     = Σ(세트.열생산용량_kW × 수량) × (중간h + 최대h) × 월별가동일
 *   월간_가스사용_kWh   = Σ(라이브러리[모델].가스소비량_kW × 수량) × (중간h + 최대h) × 월별가동일
 *
 * 부분부하 효율은 라이브러리에 없으므로 정격 출력 단순 비례 가정.
 * 가스소비량은 발전효율로 역산하지 않고 라이브러리 값을 직접 사용.
 *
 * null 처리:
 *   - 필수 입력(모델/수량/운전유형) 누락 시 해당 항목은 null 반환
 *   - 라이브러리에서 모델 미발견 또는 가스소비량_kW null → 가스 항목 null
 *   - 열생산용량_kW null → 해당 세트 열생산 0 기여
 */
import type { z } from 'zod';
import type { fuelCellInputSchema, operationInputSchema } from '@/lib/schemas/inputs';
import type { fuelCellLibrarySchema, operationLibrarySchema } from '@/lib/schemas/library';
import type { EnergyProductionOutput, EnergyProductionRow } from '@/types/outputs';

type FuelCellInput = z.infer<typeof fuelCellInputSchema>;
type OperationInput = z.infer<typeof operationInputSchema>;
type FuelCellLibrary = z.infer<typeof fuelCellLibrarySchema>;
type OperationLibrary = z.infer<typeof operationLibrarySchema>;

export interface CalcProductionParams {
  fuelCell: FuelCellInput;
  operation: OperationInput;
  fuelCellLibrary: FuelCellLibrary;
  operationLibrary: OperationLibrary;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

interface SetAggregate {
  capacityKW: number;
  heatKW: number;
  gasKW: number | null; // 하나라도 null이면 null
}

function aggregateSets(sets: FuelCellInput['sets'], library: FuelCellLibrary): SetAggregate {
  let capacityKW = 0;
  let heatKW = 0;
  let gasKW: number | null = 0;

  for (const set of sets) {
    const qty = set.설치수량;
    if (qty == null || qty <= 0) continue;
    if (set.발전용량_kW == null) continue;

    capacityKW += set.발전용량_kW * qty;
    heatKW += (set.열생산용량_kW ?? 0) * qty;

    // 라이브러리에서 가스소비량 룩업
    if (gasKW !== null) {
      const product = library.find((p) => p.모델명 === set.모델);
      const g = product?.가스소비량_kW;
      if (g == null) {
        gasKW = null;
      } else {
        gasKW += g * qty;
      }
    }
  }

  return { capacityKW, heatKW, gasKW };
}

/**
 * 12개월 EnergyProductionRow + 합계 계산.
 */
export function calcEnergyProduction(params: CalcProductionParams): EnergyProductionOutput {
  const { fuelCell, operation, fuelCellLibrary, operationLibrary } = params;

  const agg = aggregateSets(fuelCell.sets, fuelCellLibrary);
  const profileKey = operation.연간운전유형;
  const profile = profileKey ? operationLibrary[profileKey] : undefined;
  const hMid = operation.일일_중간부하_운전시간;
  const hMax = operation.일일_최대부하_운전시간;
  const hTotal = hMid + hMax;

  const rows: EnergyProductionRow[] = MONTHS.map((월, idx) => {
    const days = profile?.월별가동일[idx] ?? null;
    const usable = days != null && agg.capacityKW > 0;

    const midKWh = usable ? agg.capacityKW * hMid * days : null;
    const maxKWh = usable ? agg.capacityKW * hMax * days : null;
    const heatKWh = usable ? agg.heatKW * hTotal * days : null;
    const gasKWh = usable && agg.gasKW != null ? agg.gasKW * hTotal * days : null;

    return {
      월,
      일수: days,
      계약용량_kW: agg.capacityKW > 0 ? agg.capacityKW : null,
      월간_중간부하시간_전력생산량_kWh: midKWh,
      월간_최대부하시간_전력생산량_kWh: maxKWh,
      월간_연료전지_열생산량_kWh: heatKWh,
      월간_도시가스사용량_kWh: gasKWh,
    };
  });

  const total = sumRows(rows);

  return {
    columns: [
      '월',
      '일수',
      '계약용량_kW',
      '월간_중간부하시간_전력생산량_kWh',
      '월간_최대부하시간_전력생산량_kWh',
      '월간_연료전지_열생산량_kWh',
      '월간_도시가스사용량_kWh',
    ],
    데이터: rows,
    합계: total,
  };
}

function sumRows(rows: EnergyProductionRow[]): EnergyProductionOutput['합계'] {
  const sumNullable = (key: keyof EnergyProductionRow): number | null => {
    let acc: number | null = null;
    for (const r of rows) {
      const v = r[key];
      if (typeof v !== 'number') continue;
      acc = (acc ?? 0) + v;
    }
    return acc;
  };

  return {
    일수: sumNullable('일수'),
    계약용량_kW: rows[0]?.계약용량_kW ?? null, // 계약용량은 월별 동일 → 대표값
    월간_중간부하시간_전력생산량_kWh: sumNullable('월간_중간부하시간_전력생산량_kWh'),
    월간_최대부하시간_전력생산량_kWh: sumNullable('월간_최대부하시간_전력생산량_kWh'),
    월간_연료전지_열생산량_kWh: sumNullable('월간_연료전지_열생산량_kWh'),
    월간_도시가스사용량_kWh: sumNullable('월간_도시가스사용량_kWh'),
  };
}
