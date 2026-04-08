'use client';

/**
 * Phase 4e — 결과 섹션 통합.
 *
 * 입력값 + 4종 라이브러리를 받아 클라이언트 측 useMemo로 계산,
 * 유효한 경우에만 결과 표/카드를 렌더링.
 */
import { useMemo, useState } from 'react';
import type { FuelCellLibrary } from '@/types/fuelCell';
import type { OperationLibrary } from '@/types/operation';
import type { ElectricityTariffLibrary, GasTariffLibrary } from '@/types/tariff';
import type { FuelCellInputSet, OperationInput } from '@/types/inputs';
import { calcEnergyProduction } from '@/lib/calc/energy/production';
import { calcEnergyRevenue } from '@/lib/calc/revenue/revenue';
import { calcEconomics, calcPaybackYears } from '@/lib/calc/economics/economics';
import { EnergyProductionTable } from './EnergyProductionTable';
import { RevenueTable } from './RevenueTable';
import {
  EconomicsSettingsPanel,
  DEFAULT_SETTINGS,
  type EconomicsSettings,
} from './EconomicsSettingsPanel';
import { EconomicsResult } from './EconomicsResult';

interface Props {
  fuelCellSets: FuelCellInputSet[];
  fuelCellTotal: number;
  operation: OperationInput | null;
  operationValid: boolean;
  libraries: {
    fuelCell: FuelCellLibrary;
    operation: OperationLibrary;
    electricity: ElectricityTariffLibrary;
    gas: GasTariffLibrary;
  };
}

export function ResultsSection({
  fuelCellSets,
  fuelCellTotal,
  operation,
  operationValid,
  libraries,
}: Props) {
  const [settings, setSettings] = useState<EconomicsSettings>(DEFAULT_SETTINGS);

  const computed = useMemo(() => {
    if (!operationValid || !operation || fuelCellSets.length === 0 || fuelCellTotal <= 0) {
      return null;
    }
    const production = calcEnergyProduction({
      fuelCell: { sets: fuelCellSets, 총설치용량_kW: fuelCellTotal },
      operation,
      fuelCellLibrary: libraries.fuelCell,
      operationLibrary: libraries.operation,
    });
    const revenue = calcEnergyRevenue({
      production,
      electricityTariff: libraries.electricity,
      gasTariff: libraries.gas,
      boilerEfficiency: settings.boilerEfficiency,
    });
    const econ = calcEconomics({
      fuelCell: { sets: fuelCellSets, 총설치용량_kW: fuelCellTotal },
      fuelCellLibrary: libraries.fuelCell,
      production,
      revenue,
      lifetime: settings.lifetime,
      discountRate: settings.discountRate,
      maintenanceMode: settings.maintenanceMode,
      maintenanceRatio: settings.maintenanceRatio,
      electricityEscalation: settings.electricityEscalation,
      gasEscalation: settings.gasEscalation,
      maintenanceEscalation: settings.maintenanceEscalation,
    });
    const payback = calcPaybackYears(econ.annual);
    return { production, revenue, econ, payback };
  }, [fuelCellSets, fuelCellTotal, operation, operationValid, libraries, settings]);

  if (!computed) {
    return (
      <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-sm text-zinc-500">
        연료전지 세트와 운전시간을 모두 입력하면 결과가 표시됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <EconomicsSettingsPanel value={settings} onChange={setSettings} />

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">에너지 산출</h3>
        <EnergyProductionTable data={computed.production} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">에너지 수익</h3>
        <RevenueTable data={computed.revenue} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">경제성 분석</h3>
        <EconomicsResult result={computed.econ} payback={computed.payback} />
      </section>
    </div>
  );
}
