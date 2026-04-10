/**
 * Phase 8-3 — 목표 IRR / 회수기간 역산 (이진탐색).
 *
 * 역산 가능한 조합:
 *   (목표 IRR      | 목표 회수기간) × (최대 허용 CAPEX | 필요 최소 발전수익)
 *
 * 모두 단조함수이므로 bisection으로 수렴한다 (1원 정밀도, 최대 60회).
 *
 * 반환값 해석:
 *   - solveCapexForTarget*  → 해당 목표를 달성할 수 있는 최대 CAPEX (원)
 *   - solveElecRevForTarget* → 해당 목표를 달성하기 위해 필요한 최소 연간 발전수익 (원)
 *   - null → 해당 범위에서 수렴하지 않음 (달성 불가)
 */
import { irr as calcIrr, type MaintenanceMode } from './economics/economics';

export interface InverseCalcInput {
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

function buildCashflows(
  capex: number,
  baseElecRev: number,
  baseHeatRev: number,
  baseGasCost: number,
  baseMaint: number,
  lifetime: number,
  e: number,
  g: number,
  mEsc: number,
): number[] {
  const cf: number[] = [-capex];
  for (let t = 1; t <= lifetime; t++) {
    const net =
      baseElecRev * (1 + e) ** (t - 1) +
      baseHeatRev * (1 + g) ** (t - 1) -
      baseGasCost * (1 + g) ** (t - 1) -
      baseMaint * (1 + mEsc) ** (t - 1);
    cf.push(net);
  }
  return cf;
}

function paybackFromCashflows(cashflows: number[]): number | null {
  let cum = 0;
  for (let i = 0; i < cashflows.length; i++) {
    const prev = cum;
    cum += cashflows[i];
    if (i > 0 && prev < 0 && cum >= 0) {
      return i - 1 + -prev / (cum - prev);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// CAPEX 역산
// ─────────────────────────────────────────────────────────────

/**
 * 목표 IRR을 달성하는 최대 허용 CAPEX.
 * CAPEX ↑ → IRR ↓ (단조감소).
 */
export function solveCapexForTargetIrr(targetIrr: number, input: InverseCalcInput): number | null {
  const {
    baseElecRev,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    lifetime,
    electricityEscalation: e,
    gasEscalation: g,
    maintenanceEscalation: mEsc,
  } = input;

  function irrAt(capex: number): number | null {
    return calcIrr(
      buildCashflows(capex, baseElecRev, baseHeatRev, baseGasCost, baseMaint, lifetime, e, g, mEsc),
    );
  }

  // lo: 현재 연간순수익의 2배 미만에서 IRR이 매우 높음 → 목표보다 높음
  let lo = 0;
  let hi = Math.max(input.capex * 5, 1e9);

  // hi에서 IRR이 목표보다 낮아질 때까지 확장
  for (let i = 0; i < 20 && (irrAt(hi) ?? -Infinity) >= targetIrr; i++) hi *= 2;

  // lo에서 IRR이 목표보다 낮으면 달성 불가
  if ((irrAt(lo + 1) ?? -Infinity) < targetIrr) return null;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = irrAt(mid);
    if (r == null || r < targetIrr) {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 1) break;
  }
  return lo;
}

/**
 * 목표 회수기간을 달성하는 최대 허용 CAPEX.
 * CAPEX ↑ → 회수기간 ↑ (단조증가).
 */
export function solveCapexForTargetPayback(
  targetPayback: number,
  input: InverseCalcInput,
): number | null {
  const {
    baseElecRev,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    lifetime,
    electricityEscalation: e,
    gasEscalation: g,
    maintenanceEscalation: mEsc,
  } = input;

  function paybackAt(capex: number): number | null {
    return paybackFromCashflows(
      buildCashflows(capex, baseElecRev, baseHeatRev, baseGasCost, baseMaint, lifetime, e, g, mEsc),
    );
  }

  let lo = 0;
  let hi = Math.max(input.capex * 5, 1e9);

  // hi에서 회수기간이 목표를 초과(또는 null)할 때까지 확장
  for (let i = 0; i < 20; i++) {
    const pb = paybackAt(hi);
    if (pb == null || pb > targetPayback) break;
    hi *= 2;
  }

  // lo(≈0)에서 회수기간이 목표보다 크면 달성 불가 (수익이 너무 낮음)
  const pbAtLo = paybackAt(lo + 1);
  if (pbAtLo != null && pbAtLo > targetPayback) return null;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pb = paybackAt(mid);
    if (pb == null || pb > targetPayback) {
      hi = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 1) break;
  }
  return lo;
}

// ─────────────────────────────────────────────────────────────
// 발전수익 역산
// ─────────────────────────────────────────────────────────────

/**
 * 목표 IRR을 달성하기 위한 최소 연간 발전수익.
 * 발전수익 ↑ → IRR ↑ (단조증가).
 */
export function solveElecRevForTargetIrr(
  targetIrr: number,
  input: InverseCalcInput,
): number | null {
  const {
    capex,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    lifetime,
    electricityEscalation: e,
    gasEscalation: g,
    maintenanceEscalation: mEsc,
  } = input;

  function irrAt(elecRev: number): number | null {
    return calcIrr(
      buildCashflows(capex, elecRev, baseHeatRev, baseGasCost, baseMaint, lifetime, e, g, mEsc),
    );
  }

  // 이미 달성한 경우
  const cur = irrAt(input.baseElecRev);
  if (cur != null && cur >= targetIrr) return input.baseElecRev;

  let lo = 0;
  let hi = Math.max(input.baseElecRev * 5, 1e9);

  // hi에서 달성될 때까지 확장
  for (let i = 0; i < 20 && (irrAt(hi) ?? -Infinity) < targetIrr; i++) hi *= 2;

  if ((irrAt(hi) ?? -Infinity) < targetIrr) return null; // 수렴 불가

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = irrAt(mid);
    if (r == null || r < targetIrr) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1) break;
  }
  return hi;
}

/**
 * 목표 회수기간을 달성하기 위한 최소 연간 발전수익.
 * 발전수익 ↑ → 회수기간 ↓ (단조감소).
 */
export function solveElecRevForTargetPayback(
  targetPayback: number,
  input: InverseCalcInput,
): number | null {
  const {
    capex,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    lifetime,
    electricityEscalation: e,
    gasEscalation: g,
    maintenanceEscalation: mEsc,
  } = input;

  function paybackAt(elecRev: number): number | null {
    return paybackFromCashflows(
      buildCashflows(capex, elecRev, baseHeatRev, baseGasCost, baseMaint, lifetime, e, g, mEsc),
    );
  }

  // 이미 달성한 경우
  const cur = paybackAt(input.baseElecRev);
  if (cur != null && cur <= targetPayback) return input.baseElecRev;

  let lo = 0;
  let hi = Math.max(input.baseElecRev * 5, 1e9);

  // hi에서 달성될 때까지 확장
  for (let i = 0; i < 20; i++) {
    const pb = paybackAt(hi);
    if (pb != null && pb <= targetPayback) break;
    hi *= 2;
  }

  const pbAtHi = paybackAt(hi);
  if (pbAtHi == null || pbAtHi > targetPayback) return null; // 수렴 불가

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pb = paybackAt(mid);
    if (pb == null || pb > targetPayback) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1) break;
  }
  return hi;
}
