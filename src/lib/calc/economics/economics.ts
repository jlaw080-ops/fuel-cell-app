/**
 * Phase 3c — 경제성 계산 (순수 함수, 연단위 20년).
 *
 * 산식 (Phase 3 §3c):
 *   CAPEX        = Σ(세트.발전용량_kW × 수량 × 라이브러리.kW당설치단가)
 *   기준연간수익  = Σ(12개월 발전수익) + Σ(열수익) − Σ(가스요금)   ← 3b 산출 합계
 *   기준연간유지비:
 *     mode='fixedCost' (기본): Σ(세트.발전용량_kW × 수량 × kW당연간유지비용)
 *     mode='ratio'           : CAPEX × maintenanceRatio (기본 0.08)
 *
 *   t년차 (1..N):
 *     elecRev_t = base.발전수익 × (1+e)^(t-1)        // 전기상승률
 *     heatRev_t = base.열수익   × (1+g)^(t-1)        // 열은 가스대체 → 가스상승률
 *     gasCost_t = base.가스요금 × (1+g)^(t-1)
 *     maint_t   = base.maint    × (1+m)^(t-1)        // 유지보수상승률
 *     총수익_t  = elecRev_t + heatRev_t − gasCost_t
 *     순현금흐름_t = 총수익_t − maint_t
 *     할인_t   = 순현금흐름_t / (1+r)^t
 *
 *   0년차: 연도=0, 총수익=0, 유지비=0, 순현금흐름=−CAPEX, 누적=−CAPEX, 할인=−CAPEX
 *
 *   LCOE = (CAPEX + Σ maint_t/(1+r)^t) / Σ elecGen_t/(1+r)^t   [원/kWh, 전기만]
 *   NPV  = Σ 할인_t  (0..N 포함)
 *   IRR  = 순현금흐름 cashflow에서 NPV=0이 되는 r (Newton-Raphson)
 *   회수기간(단순) = 누적순현금흐름이 0을 넘는 연도 (선형보간)
 *
 *   Summary 기간(5/10/15/20년):
 *     누적수익 = Σ 총수익_1..k
 *     누적유지비 = Σ maint_1..k
 *     초기투자비용 = CAPEX
 *     총비용 = CAPEX + 누적유지비
 *     ROI_초기투자 = (누적수익 − 총비용) / CAPEX
 *     ROI_총비용  = (누적수익 − 총비용) / 총비용
 *     NPV = Σ 할인_0..k
 *     IRR = cashflows_0..k 의 IRR
 */
import type { z } from 'zod';
import type { fuelCellInputSchema } from '@/lib/schemas/inputs';
import type { fuelCellLibrarySchema } from '@/lib/schemas/library';
import type {
  EnergyProductionOutput,
  EnergyRevenueOutput,
  AnnualEconomicsOutput,
  AnnualEconomicsRow,
  EconomicsSummaryOutput,
  EconomicsSummaryRow,
} from '@/types/outputs';

type FuelCellInput = z.infer<typeof fuelCellInputSchema>;
type FuelCellLibrary = z.infer<typeof fuelCellLibrarySchema>;

export type MaintenanceMode = 'fixedCost' | 'ratio';

export interface EconomicsParams {
  fuelCell: FuelCellInput;
  fuelCellLibrary: FuelCellLibrary;
  production: EnergyProductionOutput;
  revenue: EnergyRevenueOutput;
  /** 분석기간(년). 기본 20. */
  lifetime?: number;
  /** 할인율(명목, 소수). 기본 0.02. */
  discountRate?: number;
  /** 유지보수 모드. 기본 'fixedCost'. */
  maintenanceMode?: MaintenanceMode;
  /** ratio 모드일 때 CAPEX 대비 비율. 기본 0.08. */
  maintenanceRatio?: number;
  /** 전기요금 상승률(소수). 기본 0. */
  electricityEscalation?: number;
  /** 가스요금 상승률(소수). 기본 0. 열수익·가스요금 모두 적용. */
  gasEscalation?: number;
  /** 유지보수비 상승률(소수). 기본 0. */
  maintenanceEscalation?: number;
  /** Summary 기간 목록. 기본 [5,10,15,20]. */
  summaryPeriods?: number[];
}

export const DEFAULTS = {
  lifetime: 20,
  discountRate: 0.02,
  maintenanceMode: 'fixedCost' as MaintenanceMode,
  maintenanceRatio: 0.08,
  electricityEscalation: 0,
  gasEscalation: 0,
  maintenanceEscalation: 0,
  summaryPeriods: [5, 10, 15, 20],
};

export interface EconomicsResult {
  capex: number | null;
  baseAnnualMaintenance: number | null;
  baseAnnualElectricityKWh: number | null;
  lcoe_원per_kWh: number | null;
  annual: AnnualEconomicsOutput;
  summary: EconomicsSummaryOutput;
}

// ─────────────────────────────────────────────────────────────
// CAPEX & 기준 유지비
// ─────────────────────────────────────────────────────────────
export function calcCapex(fuelCell: FuelCellInput, library: FuelCellLibrary): number | null {
  let capex = 0;
  let any = false;
  for (const set of fuelCell.sets) {
    if (set.발전용량_kW == null || set.설치수량 == null) continue;
    const product = library.find((p) => p.모델명 === set.모델);
    if (!product || product.kW당설치단가 == null) return null;
    capex += set.발전용량_kW * set.설치수량 * product.kW당설치단가;
    any = true;
  }
  return any ? capex : null;
}

export function calcFixedMaintenance(
  fuelCell: FuelCellInput,
  library: FuelCellLibrary,
): number | null {
  let total = 0;
  let any = false;
  for (const set of fuelCell.sets) {
    if (set.발전용량_kW == null || set.설치수량 == null) continue;
    const product = library.find((p) => p.모델명 === set.모델);
    if (!product || product.kW당연간유지비용 == null) return null;
    total += set.발전용량_kW * set.설치수량 * product.kW당연간유지비용;
    any = true;
  }
  return any ? total : null;
}

// ─────────────────────────────────────────────────────────────
// NPV / IRR
// ─────────────────────────────────────────────────────────────
export function npv(rate: number, cashflows: number[]): number {
  let s = 0;
  for (let t = 0; t < cashflows.length; t++) s += cashflows[t] / Math.pow(1 + rate, t);
  return s;
}

/** Newton-Raphson IRR. 수렴 실패 시 null. */
export function irr(cashflows: number[], guess = 0.1): number | null {
  let r = guess;
  for (let i = 0; i < 100; i++) {
    let f = 0;
    let df = 0;
    for (let t = 0; t < cashflows.length; t++) {
      const denom = Math.pow(1 + r, t);
      f += cashflows[t] / denom;
      if (t > 0) df += (-t * cashflows[t]) / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(f) < 1e-6) return r;
    if (df === 0) return null;
    const next = r - f / df;
    if (!Number.isFinite(next)) return null;
    if (next <= -0.999) {
      r = -0.99;
      continue;
    }
    if (Math.abs(next - r) < 1e-9) return next;
    r = next;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────
export function calcEconomics(params: EconomicsParams): EconomicsResult {
  const lifetime = params.lifetime ?? DEFAULTS.lifetime;
  const r = params.discountRate ?? DEFAULTS.discountRate;
  const mode = params.maintenanceMode ?? DEFAULTS.maintenanceMode;
  const ratio = params.maintenanceRatio ?? DEFAULTS.maintenanceRatio;
  const e = params.electricityEscalation ?? DEFAULTS.electricityEscalation;
  const g = params.gasEscalation ?? DEFAULTS.gasEscalation;
  const m = params.maintenanceEscalation ?? DEFAULTS.maintenanceEscalation;
  const periods = params.summaryPeriods ?? DEFAULTS.summaryPeriods;

  const capex = calcCapex(params.fuelCell, params.fuelCellLibrary);

  // 기준 연간 값 (12개월 합계)
  const baseElecRev = params.revenue.합계.발전_월간총수익_원;
  const baseHeatRev = params.revenue.합계.열생산_월간총수익_원;
  const baseGasCost = params.revenue.합계.도시가스사용요금_원;
  const elecGenMid = params.production.합계.월간_중간부하시간_전력생산량_kWh;
  const elecGenMax = params.production.합계.월간_최대부하시간_전력생산량_kWh;
  const baseElecKWh = elecGenMid != null && elecGenMax != null ? elecGenMid + elecGenMax : null;

  let baseMaint: number | null = null;
  if (mode === 'fixedCost') {
    baseMaint = calcFixedMaintenance(params.fuelCell, params.fuelCellLibrary);
  } else if (capex != null) {
    baseMaint = capex * ratio;
  }

  const computable =
    capex != null &&
    baseElecRev != null &&
    baseHeatRev != null &&
    baseGasCost != null &&
    baseMaint != null &&
    baseElecKWh != null;
  // 비-null 단언용 로컬 (computable일 때만 사용)
  const _capex = capex as number;
  const _baseElecRev = baseElecRev as number;
  const _baseHeatRev = baseHeatRev as number;
  const _baseGasCost = baseGasCost as number;
  const _baseMaint = baseMaint as number;
  const _baseElecKWh = baseElecKWh as number;

  const rows: AnnualEconomicsRow[] = [];
  const cashflowsForIrr: number[] = []; // 0..lifetime
  let cumNet = 0;

  // 0년차
  if (computable) {
    cumNet = -_capex;
    rows.push({
      연도: 0,
      총수익_원: 0,
      유지보수비용_원: 0,
      순현금흐름_원: -_capex,
      누적순현금흐름_원: cumNet,
      할인순현금흐름_원: -_capex,
    });
    cashflowsForIrr.push(-_capex);
  } else {
    rows.push({
      연도: 0,
      총수익_원: null,
      유지보수비용_원: null,
      순현금흐름_원: null,
      누적순현금흐름_원: null,
      할인순현금흐름_원: null,
    });
  }

  // 1..lifetime
  for (let t = 1; t <= lifetime; t++) {
    if (!computable) {
      rows.push({
        연도: t,
        총수익_원: null,
        유지보수비용_원: null,
        순현금흐름_원: null,
        누적순현금흐름_원: null,
        할인순현금흐름_원: null,
      });
      continue;
    }
    const elec = _baseElecRev * Math.pow(1 + e, t - 1);
    const heat = _baseHeatRev * Math.pow(1 + g, t - 1);
    const gas = _baseGasCost * Math.pow(1 + g, t - 1);
    const maint = _baseMaint * Math.pow(1 + m, t - 1);
    const totalRev = elec + heat - gas;
    const net = totalRev - maint;
    const disc = net / Math.pow(1 + r, t);
    cumNet += net;
    rows.push({
      연도: t,
      총수익_원: totalRev,
      유지보수비용_원: maint,
      순현금흐름_원: net,
      누적순현금흐름_원: cumNet,
      할인순현금흐름_원: disc,
    });
    cashflowsForIrr.push(net);
  }

  // LCOE — 전기만
  let lcoe: number | null = null;
  if (computable && _baseElecKWh > 0) {
    let discMaintSum = 0;
    let discGenSum = 0;
    for (let t = 1; t <= lifetime; t++) {
      discMaintSum += (_baseMaint * Math.pow(1 + m, t - 1)) / Math.pow(1 + r, t);
      discGenSum += _baseElecKWh / Math.pow(1 + r, t);
    }
    if (discGenSum > 0) lcoe = (_capex + discMaintSum) / discGenSum;
  }

  // Summary
  const summaryRows: EconomicsSummaryRow[] = periods.map((k) => {
    if (!computable || k > lifetime) {
      return {
        기간_년: k,
        누적수익_원: null,
        누적유지보수비용_원: null,
        '초기투자비용(설치비)_원': capex ?? null,
        총비용_원: null,
        ROI_초기투자: null,
        ROI_총비용: null,
        NPV_원: null,
        IRR: null,
      };
    }
    let cumRev = 0;
    let cumMaint = 0;
    for (let t = 1; t <= k; t++) {
      cumRev +=
        _baseElecRev * Math.pow(1 + e, t - 1) +
        _baseHeatRev * Math.pow(1 + g, t - 1) -
        _baseGasCost * Math.pow(1 + g, t - 1);
      cumMaint += _baseMaint * Math.pow(1 + m, t - 1);
    }
    const totalCost = _capex + cumMaint;
    const cfSlice = cashflowsForIrr.slice(0, k + 1); // 0..k
    return {
      기간_년: k,
      누적수익_원: cumRev,
      누적유지보수비용_원: cumMaint,
      '초기투자비용(설치비)_원': _capex,
      총비용_원: totalCost,
      ROI_초기투자: (cumRev - totalCost) / _capex,
      ROI_총비용: totalCost > 0 ? (cumRev - totalCost) / totalCost : null,
      NPV_원: npv(r, cfSlice),
      IRR: irr(cfSlice),
    };
  });

  return {
    capex,
    baseAnnualMaintenance: baseMaint,
    baseAnnualElectricityKWh: baseElecKWh,
    lcoe_원per_kWh: lcoe,
    annual: {
      columns: [
        '연도',
        '총수익_원',
        '유지보수비용_원',
        '순현금흐름_원',
        '누적순현금흐름_원',
        '할인순현금흐름_원',
      ],
      데이터: rows,
    },
    summary: {
      columns: [
        '기간_년',
        '누적수익_원',
        '누적유지보수비용_원',
        '초기투자비용(설치비)_원',
        '총비용_원',
        'ROI_초기투자',
        'ROI_총비용',
        'NPV_원',
        'IRR',
      ],
      데이터: summaryRows,
    },
  };
}

/**
 * 단순 회수기간(년). 누적순현금흐름이 처음 0을 넘는 시점을 선형보간.
 * 회수 불가 시 null.
 */
export function calcPaybackYears(annual: AnnualEconomicsOutput): number | null {
  const rows = annual.데이터;
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1].누적순현금흐름_원;
    const cur = rows[i].누적순현금흐름_원;
    if (prev == null || cur == null) return null;
    if (prev < 0 && cur >= 0) {
      const fraction = -prev / (cur - prev);
      return rows[i - 1].연도 + fraction;
    }
  }
  return null;
}
