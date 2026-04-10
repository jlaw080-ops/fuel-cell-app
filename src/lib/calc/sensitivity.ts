/**
 * Phase 8-1 — 민감도 분석 (Sensitivity Analysis).
 *
 * 5개 주요 변수 × 5개 변동률(-20/-10/0/+10/+20%) = 25 시나리오.
 * 각 시나리오에서 NPV, IRR, 단순회수기간을 재계산한다.
 *
 * 변수:
 *   - 전기요금   : baseElecRev × factor
 *   - 가스요금   : baseHeatRev × factor, baseGasCost × factor (모두 가스단가 연동)
 *   - 설치단가   : capex × factor, baseMaint × factor (ratio 모드인 경우)
 *   - 할인율     : discountRate × (1 + delta)
 *   - 운전시간   : 전기·열 수익 및 가스비 모두 factor 적용 (생산량에 비례)
 */
import { npv, irr, type MaintenanceMode } from './economics/economics';

export const SENSITIVITY_DELTAS = [-0.2, -0.1, 0, 0.1, 0.2] as const;
export type SensitivityDelta = (typeof SENSITIVITY_DELTAS)[number];

export type SensitivityParamKey =
  | 'electricity'
  | 'gas'
  | 'capex'
  | 'discountRate'
  | 'operatingHours';

export interface ScenarioResult {
  npv: number | null;
  irr: number | null;
  payback: number | null;
}

export interface SensitivityRow {
  paramKey: SensitivityParamKey;
  label: string;
  scenarios: ScenarioResult[]; // index 0..4 → SENSITIVITY_DELTAS
}

export type SensitivityAnalysis = SensitivityRow[];

export interface SensitivityInput {
  capex: number;
  /** 기준 연간 발전수익 (원) */
  baseElecRev: number;
  /** 기준 연간 열수익 (원) */
  baseHeatRev: number;
  /** 기준 연간 도시가스비 (원) */
  baseGasCost: number;
  /** 기준 연간 유지보수비 — 1년차 (원) */
  baseMaint: number;
  maintenanceMode: MaintenanceMode;
  lifetime: number;
  discountRate: number;
  electricityEscalation: number;
  gasEscalation: number;
  maintenanceEscalation: number;
}

// ─────────────────────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────────────────────

/** 단일 시나리오 계산 (연간 현금흐름 재구성 후 NPV/IRR/회수기간). */
function runScenario(
  capex: number,
  baseElecRev: number,
  baseHeatRev: number,
  baseGasCost: number,
  baseMaint: number,
  lifetime: number,
  r: number,
  e: number,
  g: number,
  mEsc: number,
): ScenarioResult {
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
    npv: npv(r, cashflows),
    irr: irr(cashflows),
    payback,
  };
}

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

/**
 * 5개 변수에 대한 민감도 분석을 수행한다.
 * 각 변수마다 SENSITIVITY_DELTAS(−20/−10/0/+10/+20%)를 적용한 5개 시나리오를 계산한다.
 */
export function calcSensitivity(input: SensitivityInput): SensitivityAnalysis {
  const {
    capex,
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

  const base = runScenario(
    capex,
    baseElecRev,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    lifetime,
    discountRate,
    e,
    g,
    mEsc,
  );
  // base 값을 delta=0 시나리오로 사용 (재계산 일관성)

  const rows: SensitivityAnalysis = [];

  // 1. 전기요금
  rows.push({
    paramKey: 'electricity',
    label: '전기요금',
    scenarios: SENSITIVITY_DELTAS.map((delta) => {
      if (delta === 0) return base;
      const f = 1 + delta;
      return runScenario(
        capex,
        baseElecRev * f,
        baseHeatRev,
        baseGasCost,
        baseMaint,
        lifetime,
        discountRate,
        e,
        g,
        mEsc,
      );
    }),
  });

  // 2. 가스요금 (열수익·가스비 모두 가스단가에 연동)
  rows.push({
    paramKey: 'gas',
    label: '가스요금',
    scenarios: SENSITIVITY_DELTAS.map((delta) => {
      if (delta === 0) return base;
      const f = 1 + delta;
      return runScenario(
        capex,
        baseElecRev,
        baseHeatRev * f,
        baseGasCost * f,
        baseMaint,
        lifetime,
        discountRate,
        e,
        g,
        mEsc,
      );
    }),
  });

  // 3. 설치단가 (CAPEX)
  //    ratio 모드: 유지보수비도 CAPEX 비례로 스케일
  rows.push({
    paramKey: 'capex',
    label: '설치단가 (CAPEX)',
    scenarios: SENSITIVITY_DELTAS.map((delta) => {
      if (delta === 0) return base;
      const f = 1 + delta;
      const scaledMaint = maintenanceMode === 'ratio' ? baseMaint * f : baseMaint;
      return runScenario(
        capex * f,
        baseElecRev,
        baseHeatRev,
        baseGasCost,
        scaledMaint,
        lifetime,
        discountRate,
        e,
        g,
        mEsc,
      );
    }),
  });

  // 4. 할인율
  rows.push({
    paramKey: 'discountRate',
    label: '할인율',
    scenarios: SENSITIVITY_DELTAS.map((delta) => {
      if (delta === 0) return base;
      const scaledRate = discountRate * (1 + delta);
      return runScenario(
        capex,
        baseElecRev,
        baseHeatRev,
        baseGasCost,
        baseMaint,
        lifetime,
        scaledRate,
        e,
        g,
        mEsc,
      );
    }),
  });

  // 5. 운전시간 (전기·열·가스 모두 생산량에 비례)
  rows.push({
    paramKey: 'operatingHours',
    label: '연간 운전시간',
    scenarios: SENSITIVITY_DELTAS.map((delta) => {
      if (delta === 0) return base;
      const f = 1 + delta;
      return runScenario(
        capex,
        baseElecRev * f,
        baseHeatRev * f,
        baseGasCost * f,
        baseMaint,
        lifetime,
        discountRate,
        e,
        g,
        mEsc,
      );
    }),
  });

  return rows;
}
