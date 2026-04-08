/**
 * Phase 5 — 리포트 스냅샷 빌더 (클라이언트에서 호출).
 *
 * 결과 섹션이 계산한 값을 그대로 스냅샷으로 패킹한다.
 */
import type { ReportSnapshot } from '@/lib/schemas/report';
import type { FuelCellInput, OperationInput } from '@/types/inputs';
import type { EnergyProductionOutput, EnergyRevenueOutput } from '@/types/outputs';
import type { EconomicsResult } from '@/lib/calc/economics/economics';
import type { EconomicsSettings } from '@/components/results/EconomicsSettingsPanel';

export interface BuildSnapshotInput {
  fuelCell: FuelCellInput;
  operation: OperationInput;
  settings: EconomicsSettings;
  production: EnergyProductionOutput;
  revenue: EnergyRevenueOutput;
  economics: EconomicsResult;
  paybackYears: number | null;
  title?: string;
}

export function buildReportSnapshot(i: BuildSnapshotInput): ReportSnapshot {
  return {
    version: 1,
    inputs: {
      fuelCell: i.fuelCell,
      operation: i.operation,
    },
    settings: i.settings,
    results: {
      production: i.production,
      revenue: i.revenue,
      economics: i.economics,
      paybackYears: i.paybackYears,
    },
    meta: {
      createdAt: new Date().toISOString(),
      title: i.title,
    },
  };
}

const LOCAL_KEY = 'fc-app-report-draft';

export function saveReportDraftLocal(snapshot: ReportSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshot));
  } catch {
    // 용량 초과 무시
  }
}

export function loadReportDraftLocal(): ReportSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReportSnapshot;
  } catch {
    return null;
  }
}
