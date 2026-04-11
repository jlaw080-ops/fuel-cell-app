'use client';

/**
 * Phase 4e — 결과 섹션 통합.
 *
 * 입력값 + 4종 라이브러리를 받아 클라이언트 측 useMemo로 계산,
 * 유효한 경우에만 결과 표/카드를 렌더링.
 */
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { FuelCellLibrary } from '@/types/fuelCell';
import type { OperationLibrary } from '@/types/operation';
import type { ElectricityTariffLibrary, GasTariffLibrary } from '@/types/tariff';
import type { FuelCellInputSet, OperationInput } from '@/types/inputs';
import { calcEnergyProduction } from '@/lib/calc/energy/production';
import { calcEnergyRevenue } from '@/lib/calc/revenue/revenue';
import { calcEconomics, calcPaybackYears } from '@/lib/calc/economics/economics';
import { buildReportSnapshot, saveReportDraftLocal } from '@/lib/report/buildSnapshot';
import { saveReport } from '@/lib/actions/reports';
import { getClientId } from '@/lib/session/clientId';
import { EnergyProductionTable } from './EnergyProductionTable';
import { RevenueTable } from './RevenueTable';
import {
  EconomicsSettingsPanel,
  DEFAULT_SETTINGS,
  type EconomicsSettings,
} from './EconomicsSettingsPanel';
import { EconomicsResult } from './EconomicsResult';
import { SensitivityTable } from './SensitivityTable';
import { TornadoChart } from './TornadoChart';
import { InverseCalcPanel } from './InverseCalcPanel';
import { ProfitabilityMap } from './ProfitabilityMap';
import { ReportCharts } from '@/components/charts/ReportCharts';

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
  initialSettings?: EconomicsSettings;
  initialTitle?: string | null;
}

export function ResultsSection({
  fuelCellSets,
  fuelCellTotal,
  operation,
  operationValid,
  libraries,
  initialSettings,
  initialTitle,
}: Props) {
  const [settings, setSettings] = useState<EconomicsSettings>(initialSettings ?? DEFAULT_SETTINGS);
  const [title, setTitle] = useState(initialTitle ?? '');
  useEffect(() => {
    if (initialSettings) Promise.resolve().then(() => setSettings(initialSettings));
  }, [initialSettings]);
  useEffect(() => {
    if (initialTitle != null) Promise.resolve().then(() => setTitle(initialTitle));
  }, [initialTitle]);
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [saveErr, setSaveErr] = useState<string | null>(null);

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

  function openReport(persist: boolean) {
    if (!computed || !operation) return;
    setSaveErr(null);
    const snapshot = buildReportSnapshot({
      fuelCell: { sets: fuelCellSets, 총설치용량_kW: fuelCellTotal },
      operation,
      settings,
      production: computed.production,
      revenue: computed.revenue,
      economics: computed.econ,
      paybackYears: computed.payback,
    });
    saveReportDraftLocal(snapshot);
    if (!persist) {
      router.push('/report');
      return;
    }
    startSave(async () => {
      const clientId = getClientId() ?? '';
      const autoTitle =
        title.trim() || `${fuelCellTotal}kW 연료전지 (${new Date().toLocaleString('ko-KR')})`;
      const res = await saveReport(clientId, snapshot, autoTitle);
      if (res.ok) {
        router.push(`/report?id=${res.id}`);
      } else {
        setSaveErr(res.error);
      }
    });
  }

  // baseAnnualMaintenance가 null인 경우(fixedCost 모드이나 라이브러리에 데이터 없음)
  // CAPEX × maintenanceRatio 로 폴백하여 민감도 분석이 항상 표시되도록 함
  const baseMaintFallback =
    computed.econ.baseAnnualMaintenance ??
    (computed.econ.capex != null ? computed.econ.capex * settings.maintenanceRatio : null);

  // 수익 합계값이 null인 경우 0으로 폴백 — 가스 타리프 라이브러리에 항목 누락 시 발생
  // 민감도 분석은 0 기준으로라도 표시하며, 누락 항목은 경고 배너로 안내한다
  const baseElecRevFallback = computed.revenue.합계.발전_월간총수익_원 ?? 0;
  const baseHeatRevFallback = computed.revenue.합계.열생산_월간총수익_원 ?? 0;
  const baseGasCostFallback = computed.revenue.합계.도시가스사용요금_원 ?? 0;
  const hasPartialRevenue =
    computed.revenue.합계.발전_월간총수익_원 == null ||
    computed.revenue.합계.열생산_월간총수익_원 == null ||
    computed.revenue.합계.도시가스사용요금_원 == null;

  return (
    <div className="space-y-8">
      <EconomicsSettingsPanel value={settings} onChange={setSettings} />

      <div className="border border-zinc-200 rounded p-4 bg-zinc-50 space-y-3">
        <div className="flex items-center gap-3">
          <label htmlFor="report-title" className="text-sm text-zinc-700 whitespace-nowrap">
            리포트 제목
          </label>
          <input
            id="report-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="비워두면 자동 생성됩니다 (예: 30kW 연료전지 (...))"
            className="flex-1 px-3 py-2 border border-zinc-300 rounded text-sm bg-white"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-700 flex-1">
            리포트를 A4 형식으로 보고 PDF로 저장할 수 있습니다.
          </span>
          <button
            type="button"
            onClick={() => openReport(false)}
            className="px-3 py-2 border border-zinc-300 rounded text-sm bg-white hover:bg-zinc-50"
          >
            미리보기
          </button>
          <button
            type="button"
            onClick={() => openReport(true)}
            disabled={saving}
            className="px-3 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장 + 리포트 보기'}
          </button>
        </div>
      </div>
      {saveErr && <div className="text-sm text-red-600">{saveErr}</div>}

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

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">시각화</h3>
        <ReportCharts
          snapshot={{
            results: {
              production: computed.production,
              revenue: computed.revenue,
              economics: computed.econ,
              paybackYears: computed.payback,
            },
          }}
        />
      </section>

      {computed.econ.capex != null && baseMaintFallback != null ? (
        <>
          {hasPartialRevenue && (
            <section className="p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-700">
              <strong>수익 데이터 일부 누락</strong> — 요금 라이브러리에 항목이 없어 해당 수익을
              0으로 대체해 민감도 계산합니다. 실제와 다를 수 있습니다.
              {computed.revenue.합계.발전_월간총수익_원 == null && (
                <span>
                  {' '}
                  · <strong>발전수익 (전기요금 데이터 없음)</strong>
                </span>
              )}
              {computed.revenue.합계.열생산_월간총수익_원 == null && (
                <span>
                  {' '}
                  · <strong>열수익 (가스요금 일반용 없음)</strong>
                </span>
              )}
              {computed.revenue.합계.도시가스사용요금_원 == null && (
                <span>
                  {' '}
                  · <strong>도시가스요금 (연료전지전용 요금 없음)</strong>
                </span>
              )}
            </section>
          )}

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">민감도 분석</h3>
            <p className="text-sm text-zinc-500">
              주요 변수를 ±10% / ±20% 변동시켰을 때 NPV·IRR·회수기간이 어떻게 달라지는지 보여줍니다.
            </p>
            <SensitivityTable
              input={{
                capex: computed.econ.capex,
                baseElecRev: baseElecRevFallback,
                baseHeatRev: baseHeatRevFallback,
                baseGasCost: baseGasCostFallback,
                baseMaint: baseMaintFallback,
                maintenanceMode: settings.maintenanceMode,
                lifetime: settings.lifetime,
                discountRate: settings.discountRate,
                electricityEscalation: settings.electricityEscalation,
                gasEscalation: settings.gasEscalation,
                maintenanceEscalation: settings.maintenanceEscalation,
              }}
            />
            <h4 className="text-sm font-semibold text-zinc-700 mt-4">
              변수별 영향 — 토네이도 차트
            </h4>
            <TornadoChart
              input={{
                capex: computed.econ.capex,
                baseElecRev: baseElecRevFallback,
                baseHeatRev: baseHeatRevFallback,
                baseGasCost: baseGasCostFallback,
                baseMaint: baseMaintFallback,
                maintenanceMode: settings.maintenanceMode,
                lifetime: settings.lifetime,
                discountRate: settings.discountRate,
                electricityEscalation: settings.electricityEscalation,
                gasEscalation: settings.gasEscalation,
                maintenanceEscalation: settings.maintenanceEscalation,
              }}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">목표 역산</h3>
            <InverseCalcPanel
              input={{
                capex: computed.econ.capex,
                baseElecRev: baseElecRevFallback,
                baseHeatRev: baseHeatRevFallback,
                baseGasCost: baseGasCostFallback,
                baseMaint: baseMaintFallback,
                maintenanceMode: settings.maintenanceMode,
                lifetime: settings.lifetime,
                discountRate: settings.discountRate,
                electricityEscalation: settings.electricityEscalation,
                gasEscalation: settings.gasEscalation,
                maintenanceEscalation: settings.maintenanceEscalation,
              }}
              currentIrr20={computed.econ.summary.데이터.find((r) => r.기간_년 === 20)?.IRR ?? null}
              currentPayback={computed.payback}
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold">수익성 지도</h3>
            <p className="text-sm text-zinc-500">
              CAPEX와 발전수익을 ±50% 범위로 변동시켰을 때 수익성 지표 변화를 2D 히트맵으로
              표시합니다.
            </p>
            <ProfitabilityMap
              input={{
                capex: computed.econ.capex,
                baseElecRev: baseElecRevFallback,
                baseHeatRev: baseHeatRevFallback,
                baseGasCost: baseGasCostFallback,
                baseMaint: baseMaintFallback,
                maintenanceMode: settings.maintenanceMode,
                lifetime: settings.lifetime,
                discountRate: settings.discountRate,
                electricityEscalation: settings.electricityEscalation,
                gasEscalation: settings.gasEscalation,
                maintenanceEscalation: settings.maintenanceEscalation,
              }}
            />
          </section>
        </>
      ) : (
        <section className="space-y-2 p-4 rounded border border-amber-200 bg-amber-50">
          <h3 className="text-base font-semibold text-amber-800">
            민감도 분석 / 목표 역산 / 수익성 지도를 표시할 수 없습니다
          </h3>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            {computed.econ.capex == null && (
              <li>
                <strong>설치단가 미입력</strong> — 선택한 제품의 kW당 설치단가가 없습니다. 입력
                화면에서 &ldquo;kW당 설치단가 (원)&rdquo; 필드에 직접 입력해주세요.
              </li>
            )}
            {computed.econ.capex != null && baseMaintFallback == null && (
              <li>
                <strong>유지비 미입력</strong> — 유지비 데이터가 없습니다. 경제성 설정에서 유지비를
                직접 입력해주세요.
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
