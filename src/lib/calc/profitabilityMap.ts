/**
 * Phase 9-2 — 수익성 지도 (Profitability Map).
 *
 * CAPEX(x축) × 발전수익 배율(y축) 2D 그리드에서
 * 각 셀의 NPV·IRR·회수기간을 계산한다.
 *
 * 그리드 범위: 기준값 대비 50%~150%, 11단계(10%p 간격).
 * 기준 셀: (capexFactor=1.0, elecFactor=1.0) → 항상 col=5, row=5.
 */
import { npv, irr, type MaintenanceMode } from './economics/economics';

// ─────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────

export interface ProfitabilityMapInput {
  capex: number;
  baseElecRev: number;
  baseHeatRev: number;
  baseGasCost: number;
  baseMaint: number;
  maintenanceMode: MaintenanceMode;
  lifetime: number;
  discountRate: number;
  electricityEscalation: number;
  gasEscalation: number;
  maintenanceEscalation: number;
}

export interface MapCell {
  capexFactor: number;
  elecFactor: number;
  /** 실제 CAPEX (원) */
  capexAbs: number;
  /** 실제 연간 발전수익 (원) */
  elecRevAbs: number;
  npv: number | null;
  irr: number | null;
  payback: number | null;
}

export interface ProfitabilityMapResult {
  /** cells[rowIdx][colIdx] — rowIdx 0 = 가장 높은 elecFactor (화면 상단) */
  cells: MapCell[][];
  capexFactors: number[];
  /** 내림차순 (화면 상단이 가장 높은 발전수익) */
  elecFactors: number[];
  baseCapex: number;
  baseElecRev: number;
  lifetime: number;
}

// ─────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────

/** 50%~150% 범위, 11단계 — 기준(1.0)을 정확히 포함 */
export const MAP_FACTORS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
export const BASE_FACTOR_IDX = 5; // MAP_FACTORS에서 1.0의 인덱스

// ─────────────────────────────────────────────────────────────
// 단일 시나리오 계산 (sensitivity.ts와 동일 로직)
// ─────────────────────────────────────────────────────────────

function runScenario(
  capex: number,
  baseElecRev: number,
  baseHeatRev: number,
  baseGasCost: number,
  baseMaint: number,
  lifetime: number,
  discountRate: number,
  e: number,
  g: number,
  mEsc: number,
): { npv: number | null; irr: number | null; payback: number | null } {
  const cashflows: number[] = [-capex];
  let cumNet = -capex;
  let payback: number | null = null;

  for (let t = 1; t <= lifetime; t++) {
    const elec = baseElecRev * (1 + e) ** (t - 1);
    const heat = baseHeatRev * (1 + g) ** (t - 1);
    const gas = baseGasCost * (1 + g) ** (t - 1);
    const maint = baseMaint * (1 + mEsc) ** (t - 1);
    const net = elec + heat - gas - maint;
    cashflows.push(net);
    const prevCum = cumNet;
    cumNet += net;
    if (payback === null && prevCum < 0 && cumNet >= 0) {
      payback = t - 1 + -prevCum / (cumNet - prevCum);
    }
  }

  return {
    npv: npv(discountRate, cashflows),
    irr: irr(cashflows),
    payback,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

/**
 * CAPEX × 발전수익 2D 그리드(11×11)의 수익성 지표를 계산한다.
 */
export function calcProfitabilityMap(input: ProfitabilityMapInput): ProfitabilityMapResult {
  const {
    capex: baseCapex,
    baseElecRev,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    maintenanceMode,
    lifetime,
    discountRate,
    electricityEscalation: e,
    gasEscalation: g,
    maintenanceEscalation: mEsc,
  } = input;

  const capexFactors = [...MAP_FACTORS];
  // 화면 상단 = 높은 발전수익 → 내림차순
  const elecFactors = [...MAP_FACTORS].reverse();

  const cells: MapCell[][] = elecFactors.map((elecFactor) =>
    capexFactors.map((capexFactor) => {
      const scaledCapex = baseCapex * capexFactor;
      const scaledMaint = maintenanceMode === 'ratio' ? baseMaint * capexFactor : baseMaint;
      const scaledElecRev = baseElecRev * elecFactor;

      const result = runScenario(
        scaledCapex,
        scaledElecRev,
        baseHeatRev,
        baseGasCost,
        scaledMaint,
        lifetime,
        discountRate,
        e,
        g,
        mEsc,
      );

      return {
        capexFactor,
        elecFactor,
        capexAbs: scaledCapex,
        elecRevAbs: scaledElecRev,
        ...result,
      };
    }),
  );

  return { cells, capexFactors, elecFactors, baseCapex, baseElecRev, lifetime };
}
