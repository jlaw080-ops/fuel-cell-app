'use client';

import { useMemo } from 'react';
import { calcSensitivity, type SensitivityInput } from '@/lib/calc/sensitivity';
import { calcProfitabilityMap, type ProfitabilityMapInput } from '@/lib/calc/profitabilityMap';

interface Props {
  npv20: number | null;
  irr20: number | null;
  payback: number | null;
  discountRate: number;
  sensitivityInput: SensitivityInput;
  profitabilityMapInput: ProfitabilityMapInput;
}

type Verdict = 'viable' | 'marginal' | 'not_viable';

interface Insights {
  verdict: Verdict;
  topRiskLabel: string;
  topRiskNpvSwing: number;
  breakEvenThreshold: '10%' | '20%' | null;
  profitableCells: number;
  totalCells: number;
}

function deriveInsights(
  npv20: number | null,
  irr20: number | null,
  discountRate: number,
  sensitivityInput: SensitivityInput,
  profitabilityMapInput: ProfitabilityMapInput,
): Insights {
  let verdict: Verdict;
  if (npv20 == null || npv20 <= 0) {
    verdict = 'not_viable';
  } else if (irr20 != null && irr20 > discountRate) {
    verdict = 'viable';
  } else {
    verdict = 'marginal';
  }

  const sensitivityRows = calcSensitivity(sensitivityInput);
  let topRiskLabel = '-';
  let topRiskNpvSwing = 0;
  let topRiskRow = sensitivityRows[0];
  for (const row of sensitivityRows) {
    const npvVals = row.scenarios.map((s) => s.npv ?? 0);
    const swing = Math.max(...npvVals) - Math.min(...npvVals);
    if (swing > topRiskNpvSwing) {
      topRiskNpvSwing = swing;
      topRiskLabel = row.label;
      topRiskRow = row;
    }
  }

  let breakEvenThreshold: '10%' | '20%' | null = null;
  if (topRiskRow) {
    const npvMinus10 = topRiskRow.scenarios[1].npv; // -10%
    const npvMinus20 = topRiskRow.scenarios[0].npv; // -20%
    if (npvMinus10 != null && npvMinus10 < 0) {
      breakEvenThreshold = '10%';
    } else if (npvMinus20 != null && npvMinus20 < 0) {
      breakEvenThreshold = '20%';
    }
  }

  const mapResult = calcProfitabilityMap(profitabilityMapInput);
  const allCells = mapResult.cells.flat();
  const totalCells = allCells.length;
  const profitableCells = allCells.filter((c) => c.npv != null && c.npv > 0).length;

  return {
    verdict,
    topRiskLabel,
    topRiskNpvSwing,
    breakEvenThreshold,
    profitableCells,
    totalCells,
  };
}

const VERDICT_CONFIG = {
  viable: {
    label: '실행 가능',
    badgeClass: 'bg-green-100 text-green-800 border-green-300',
    borderClass: 'border-green-200',
    bgClass: 'bg-green-50',
  },
  marginal: {
    label: '한계적',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    borderClass: 'border-yellow-200',
    bgClass: 'bg-yellow-50',
  },
  not_viable: {
    label: '실행 불가',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    borderClass: 'border-red-200',
    bgClass: 'bg-red-50',
  },
};

function fmtBillion(won: number): string {
  const b = won / 1e8;
  return b >= 10 ? `${b.toFixed(0)}억원` : `${b.toFixed(1)}억원`;
}

export function InsightSummary({
  npv20,
  irr20,
  payback,
  discountRate,
  sensitivityInput,
  profitabilityMapInput,
}: Props) {
  const insights = useMemo(
    () => deriveInsights(npv20, irr20, discountRate, sensitivityInput, profitabilityMapInput),
    [npv20, irr20, discountRate, sensitivityInput, profitabilityMapInput],
  );

  const cfg = VERDICT_CONFIG[insights.verdict];
  const profitPct = Math.round((insights.profitableCells / insights.totalCells) * 100);

  const breakEvenMsg =
    insights.breakEvenThreshold === '10%'
      ? `${insights.topRiskLabel} 10% 하락 시 NPV 음수 전환 (여유 적음)`
      : insights.breakEvenThreshold === '20%'
        ? `${insights.topRiskLabel} 20% 이상 하락 시 NPV 음수 전환`
        : `±20% 하락 범위 내 NPV 양수 유지`;

  const breakEvenIcon =
    insights.breakEvenThreshold === '10%' ? '✗' : insights.breakEvenThreshold === '20%' ? '△' : '✓';

  const breakEvenColor =
    insights.breakEvenThreshold === '10%'
      ? 'text-red-600'
      : insights.breakEvenThreshold === '20%'
        ? 'text-yellow-600'
        : 'text-green-700';

  return (
    <div className={`rounded-lg border p-5 space-y-4 ${cfg.bgClass} ${cfg.borderClass}`}>
      {/* 판정 배지 */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${cfg.badgeClass}`}
        >
          {cfg.label}
        </span>
        <span className="text-sm text-zinc-500">투자 진단 (20년 기준)</span>
      </div>

      {/* 3개 인사이트 행 */}
      <div className="space-y-3">
        {/* ① 최대 리스크 변수 */}
        <div className="flex items-start gap-3">
          <span className="text-amber-500 font-bold text-base mt-0.5 shrink-0">⚠</span>
          <div>
            <p className="text-sm font-medium text-zinc-800">
              최대 리스크 변수: {insights.topRiskLabel}
            </p>
            <p className="text-xs text-zinc-500">
              NPV 변동폭 {fmtBillion(insights.topRiskNpvSwing)} — 이 변수가 수익성에 가장 큰 영향
            </p>
          </div>
        </div>

        {/* ② 손익분기 임계점 */}
        <div className="flex items-start gap-3">
          <span className={`font-bold text-base mt-0.5 shrink-0 ${breakEvenColor}`}>
            {breakEvenIcon}
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-800">손익분기 임계점</p>
            <p className="text-xs text-zinc-500">{breakEvenMsg}</p>
          </div>
        </div>

        {/* ③ 수익성 시나리오 비율 */}
        <div className="flex items-start gap-3">
          <span className="text-blue-500 font-bold text-base mt-0.5 shrink-0">◈</span>
          <div>
            <p className="text-sm font-medium text-zinc-800">수익성 시나리오 {profitPct}%</p>
            <p className="text-xs text-zinc-500">
              CAPEX × 발전수익 121개 조합 중 {insights.profitableCells}개에서 NPV &gt; 0
            </p>
          </div>
        </div>
      </div>

      {/* 하단 보조 정보 */}
      <div className="border-t border-zinc-200 pt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {npv20 != null && <span>NPV(20년) {fmtBillion(npv20)}</span>}
        {irr20 != null && (
          <span>
            IRR {(irr20 * 100).toFixed(1)}% (기준 {(discountRate * 100).toFixed(1)}%)
          </span>
        )}
        {payback != null && <span>회수기간 {payback.toFixed(1)}년</span>}
      </div>
    </div>
  );
}
