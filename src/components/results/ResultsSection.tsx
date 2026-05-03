'use client';

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
import { generateAiReview } from '@/lib/gemini/review';
import { getClientId } from '@/lib/session/clientId';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EnergyProductionTable } from './EnergyProductionTable';
import { RevenueTable } from './RevenueTable';
import type { EconomicsSettings } from './EconomicsSettingsPanel';
import { EconomicsResult } from './EconomicsResult';
import { SensitivityTable } from './SensitivityTable';
import { TornadoChart } from './TornadoChart';
import { InverseCalcPanel } from './InverseCalcPanel';
import { ProfitabilityMap } from './ProfitabilityMap';
import { InsightSummary } from './InsightSummary';
import { ReportCharts } from '@/components/charts/ReportCharts';

type ResultTab = 'basic' | 'analysis' | 'ai';

function TabBar({ active, onChange }: { active: ResultTab; onChange: (t: ResultTab) => void }) {
  const tabs: { key: ResultTab; label: string }[] = [
    { key: 'basic', label: '기본 결과' },
    { key: 'analysis', label: '투자 분석' },
    { key: 'ai', label: 'AI 분석' },
  ];
  return (
    <div className="flex border-b border-[#3d3a39]">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === key
              ? 'border-[#00d992] text-[#00d992]'
              : 'border-transparent text-[#8b949e] hover:text-[#f2f2f2] hover:border-[#3d3a39]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[#3d3a39] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#101010] hover:bg-[#1a1a1a] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[#f2f2f2]">{title}</span>
        <span className="text-[#8b949e] text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease',
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 py-4 space-y-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function fmt(v: number | null | undefined, decimals = 0): string {
  if (v == null) return '—';
  return v.toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function MetricRow({
  label,
  value,
  unit,
  highlight = false,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1e1e1e] last:border-0">
      <span className="text-xs text-[#8b949e]">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-[#00d992]' : 'text-[#f2f2f2]'}`}>
        {value} <span className="text-xs text-[#8b949e]">{unit}</span>
      </span>
    </div>
  );
}

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
  settings: EconomicsSettings;
  initialTitle?: string | null;
}

export function ResultsSection({
  fuelCellSets,
  fuelCellTotal,
  operation,
  operationValid,
  libraries,
  settings,
  initialTitle,
}: Props) {
  const [title, setTitle] = useState(initialTitle ?? '');
  useEffect(() => {
    if (initialTitle != null) Promise.resolve().then(() => setTitle(initialTitle));
  }, [initialTitle]);
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('basic');
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiSkipped, setAiSkipped] = useState(false);
  const [aiLoading, startAi] = useTransition();

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
      <div className="border border-dashed border-[#3d3a39] rounded p-8 text-center text-sm text-[#8b949e]">
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

  function onGenerateAi() {
    if (!computed || !operation) return;
    const snapshot = buildReportSnapshot({
      fuelCell: { sets: fuelCellSets, 총설치용량_kW: fuelCellTotal },
      operation,
      settings,
      production: computed.production,
      revenue: computed.revenue,
      economics: computed.econ,
      paybackYears: computed.payback,
    });
    setAiSkipped(false);
    startAi(async () => {
      const res = await generateAiReview(snapshot);
      if (res.ok) {
        setAiReview(res.review);
      } else {
        setAiSkipped(true);
      }
    });
  }

  const baseMaintFallback =
    computed.econ.baseAnnualMaintenance ??
    (computed.econ.capex != null ? computed.econ.capex * settings.maintenanceRatio : null);

  const baseElecRevFallback = computed.revenue.합계.발전_월간총수익_원 ?? 0;
  const baseHeatRevFallback = computed.revenue.합계.열생산_월간총수익_원 ?? 0;
  const baseGasCostFallback = computed.revenue.합계.도시가스사용요금_원 ?? 0;
  const hasPartialRevenue =
    computed.revenue.합계.발전_월간총수익_원 == null ||
    computed.revenue.합계.열생산_월간총수익_원 == null ||
    computed.revenue.합계.도시가스사용요금_원 == null;

  const hasAnalysis = computed.econ.capex != null && baseMaintFallback != null;

  const sharedInput = hasAnalysis
    ? {
        capex: computed.econ.capex!,
        baseElecRev: baseElecRevFallback,
        baseHeatRev: baseHeatRevFallback,
        baseGasCost: baseGasCostFallback,
        baseMaint: baseMaintFallback!,
        maintenanceMode: settings.maintenanceMode,
        lifetime: settings.lifetime,
        discountRate: settings.discountRate,
        electricityEscalation: settings.electricityEscalation,
        gasEscalation: settings.gasEscalation,
        maintenanceEscalation: settings.maintenanceEscalation,
      }
    : null;

  const summary20 = computed.econ.summary.데이터.find((r) => r.기간_년 === 20);

  // 에너지·수익 요약 수치
  const annualElecKWh =
    (computed.production.합계.월간_중간부하시간_전력생산량_kWh ?? 0) +
    (computed.production.합계.월간_최대부하시간_전력생산량_kWh ?? 0);
  const annualHeatKWh = computed.production.합계.월간_연료전지_열생산량_kWh;
  const annualElecRev = computed.revenue.합계.발전_월간총수익_원;
  const annualHeatRev = computed.revenue.합계.열생산_월간총수익_원;
  const annualGasCost = computed.revenue.합계.도시가스사용요금_원;
  const annualNetRev =
    annualElecRev != null && annualHeatRev != null && annualGasCost != null
      ? annualElecRev + annualHeatRev - annualGasCost
      : null;

  return (
    <div className="space-y-4">
      {/* 리포트 저장 카드 — 탭 위 항상 표시 */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <label htmlFor="report-title" className="text-sm text-[#b8b3b0] whitespace-nowrap">
              리포트 제목
            </label>
            <input
              id="report-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="비워두면 자동 생성됩니다 (예: 30kW 연료전지 (...))"
              className="flex-1 px-3 py-2 border border-[#3d3a39] rounded text-sm bg-[#101010] text-[#f2f2f2] placeholder:text-[#8b949e]"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#b8b3b0] flex-1">
              리포트를 A4 형식으로 보고 PDF로 저장할 수 있습니다.
            </span>
            <Button type="button" onClick={() => openReport(false)} variant="outline">
              미리보기
            </Button>
            <Button type="button" onClick={() => openReport(true)} disabled={saving}>
              {saving ? '저장 중...' : '저장 + 리포트 보기'}
            </Button>
          </div>
        </CardContent>
      </Card>
      {saveErr && <div className="text-sm text-red-400">{saveErr}</div>}

      {/* 탭 바 */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* ── 탭 1: 기본 결과 ── */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          {hasPartialRevenue && (
            <section className="p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-700">
              <strong>수익 데이터 일부 누락</strong> — 요금 라이브러리에 항목이 없어 해당 수익을
              0으로 대체해 계산합니다. 실제와 다를 수 있습니다.
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

          {/* 결과 요약 */}
          <div className="border border-[#3d3a39] rounded-xl p-5 bg-[#1a1a1a]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 에너지 산출·수익 */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold text-[#b8b3b0] mb-3">에너지 산출·수익</h3>
                  <MetricRow
                    label="연간 발전량"
                    value={fmt(annualElecKWh > 0 ? annualElecKWh / 1000 : null, 1)}
                    unit="MWh/년"
                  />
                  <MetricRow
                    label="연간 열생산량"
                    value={fmt(annualHeatKWh != null ? annualHeatKWh / 1000 : null, 1)}
                    unit="MWh/년"
                  />
                  <MetricRow
                    label="연간 발전수익"
                    value={fmt(annualElecRev != null ? annualElecRev / 10000 : null, 0)}
                    unit="만원/년"
                  />
                  <MetricRow
                    label="연간 열수익"
                    value={fmt(annualHeatRev != null ? annualHeatRev / 10000 : null, 0)}
                    unit="만원/년"
                  />
                  <MetricRow
                    label="연간 도시가스요금"
                    value={fmt(annualGasCost != null ? annualGasCost / 10000 : null, 0)}
                    unit="만원/년"
                  />
                  <MetricRow
                    label="연간 순수익"
                    value={fmt(annualNetRev != null ? annualNetRev / 10000 : null, 0)}
                    unit="만원/년"
                    highlight
                  />
                </CardContent>
              </Card>

              {/* 경제성 */}
              <Card>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold text-[#b8b3b0] mb-3">경제성</h3>
                  <MetricRow
                    label="설치비 (CAPEX)"
                    value={fmt(
                      computed.econ.capex != null ? computed.econ.capex / 100_000_000 : null,
                      2,
                    )}
                    unit="억원"
                  />
                  <MetricRow label="단순 회수기간" value={fmt(computed.payback, 1)} unit="년" />
                  <MetricRow
                    label={`NPV (${settings.lifetime}년)`}
                    value={fmt(
                      summary20?.NPV_원 != null ? summary20.NPV_원 / 100_000_000 : null,
                      2,
                    )}
                    unit="억원"
                    highlight
                  />
                  <MetricRow
                    label={`IRR (${settings.lifetime}년)`}
                    value={summary20?.IRR != null ? (summary20.IRR * 100).toFixed(2) : '—'}
                    unit="%"
                    highlight
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* 차트 */}
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

          {/* 상세 (접기/펼치기) */}
          <CollapsibleSection title="에너지 산출 / 수익 상세">
            <EnergyProductionTable data={computed.production} />
            <RevenueTable data={computed.revenue} />
          </CollapsibleSection>

          <CollapsibleSection title="경제성 상세 (현금흐름)">
            <EconomicsResult result={computed.econ} payback={computed.payback} />
          </CollapsibleSection>
        </div>
      )}

      {/* ── 탭 2: 투자 분석 ── */}
      {activeTab === 'analysis' && (
        <div className="space-y-4">
          {sharedInput ? (
            <>
              <InsightSummary
                npv20={summary20?.NPV_원 ?? null}
                irr20={summary20?.IRR ?? null}
                payback={computed.payback}
                discountRate={settings.discountRate}
                sensitivityInput={sharedInput}
                profitabilityMapInput={sharedInput}
              />

              <div className="border border-zinc-200 rounded-xl p-5 bg-white space-y-3">
                <h3 className="text-base font-semibold text-zinc-600">
                  변수별 영향 — 토네이도 차트
                </h3>
                <TornadoChart input={sharedInput} />
              </div>

              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[#b8b3b0]">목표 역산</h3>
                <InverseCalcPanel
                  input={sharedInput}
                  currentIrr20={summary20?.IRR ?? null}
                  currentPayback={computed.payback}
                />
              </section>

              <CollapsibleSection title="민감도 분석 테이블">
                <SensitivityTable input={sharedInput} />
              </CollapsibleSection>

              <CollapsibleSection title="수익성 지도 (CAPEX × 발전수익)">
                <ProfitabilityMap input={sharedInput} />
              </CollapsibleSection>
            </>
          ) : (
            <section className="space-y-2 p-4 rounded border border-amber-200 bg-amber-50">
              <h3 className="text-base font-semibold text-amber-800">
                투자 진단 / 목표 역산을 표시할 수 없습니다
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
                    <strong>유지비 미입력</strong> — 유지비 데이터가 없습니다. 경제성 설정에서
                    유지비를 직접 입력해주세요.
                  </li>
                )}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* ── 탭 3: AI 분석 ── */}
      {activeTab === 'ai' && (
        <div className="w-full space-y-4">
          <div className="w-full border border-[#3d3a39] rounded-xl p-5 bg-[#1a1a1a] space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#f2f2f2]">AI 경제성 검토 의견</h3>
              <Button type="button" onClick={onGenerateAi} disabled={aiLoading} size="sm">
                {aiLoading ? 'AI 분석 중...' : aiReview ? 'AI 분석 재생성' : 'AI 분석 생성'}
              </Button>
            </div>

            {aiLoading && (
              <p className="text-sm text-[#8b949e] animate-pulse">
                AI 검토 의견을 생성 중입니다...
              </p>
            )}

            {!aiLoading && aiSkipped && (
              <div className="p-4 rounded border border-amber-200 bg-amber-50 text-sm text-amber-700">
                AI 검토 기능을 사용할 수 없습니다. (GEMINI_API_KEY 미설정 또는 API 오류)
              </div>
            )}

            {!aiLoading && aiReview && (
              <div className="text-sm text-[#e2e2e2] leading-relaxed whitespace-pre-wrap break-words">
                {aiReview}
              </div>
            )}

            {!aiLoading && !aiReview && !aiSkipped && (
              <p className="text-sm text-[#8b949e]">
                &ldquo;AI 분석 생성&rdquo; 버튼을 클릭하면 현재 분석 결과를 기반으로 AI 검토 의견을
                생성합니다. (Gemini AI 사용)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
