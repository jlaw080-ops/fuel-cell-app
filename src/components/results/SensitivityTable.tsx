'use client';

/**
 * Phase 8-1 — 민감도 분석 테이블.
 *
 * 5개 변수 × 5개 변동률(-20/-10/기준/+10/+20%)에서
 * NPV / IRR / 회수기간 변화를 색상으로 표시한다.
 */
import { useMemo } from 'react';
import {
  calcSensitivity,
  SENSITIVITY_DELTAS,
  type SensitivityAnalysis,
  type ScenarioResult,
  type SensitivityInput,
} from '@/lib/calc/sensitivity';

const nf0 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2, minimumFractionDigits: 1 });

type Metric = 'npv' | 'irr' | 'payback';

interface MetricConfig {
  key: Metric;
  label: string;
  unit: string;
  /** 기준값 대비 높을수록 좋음(true) / 낮을수록 좋음(false) */
  higherIsBetter: boolean;
  fmt: (r: ScenarioResult) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'npv',
    label: 'NPV',
    unit: '만원',
    higherIsBetter: true,
    fmt: (r) =>
      r.npv == null || !Number.isFinite(r.npv) ? '-' : nf0.format(Math.round(r.npv / 10000)) + '만',
  },
  {
    key: 'irr',
    label: 'IRR',
    unit: '%',
    higherIsBetter: true,
    fmt: (r) => (r.irr == null || !Number.isFinite(r.irr) ? '-' : `${nf2.format(r.irr * 100)}%`),
  },
  {
    key: 'payback',
    label: '회수기간',
    unit: '년',
    higherIsBetter: false,
    fmt: (r) =>
      r.payback == null || !Number.isFinite(r.payback) ? '미회수' : `${nf2.format(r.payback)}년`,
  },
];

function cellColor(
  value: number | null | undefined,
  baseValue: number | null | undefined,
  higherIsBetter: boolean,
  isBase: boolean,
): string {
  if (isBase) return 'bg-zinc-100 font-semibold text-zinc-800';
  if (
    value == null ||
    baseValue == null ||
    !Number.isFinite(value) ||
    !Number.isFinite(baseValue)
  ) {
    return 'text-zinc-400';
  }
  const diff = value - baseValue;
  if (Math.abs(diff) < 1) return 'text-zinc-700'; // 거의 동일
  const positive = higherIsBetter ? diff > 0 : diff < 0;
  return positive ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50';
}

const DELTA_LABELS = ['-20%', '-10%', '기준', '+10%', '+20%'];

interface Props {
  input: SensitivityInput;
}

export function SensitivityTable({ input }: Props) {
  const analysis: SensitivityAnalysis = useMemo(() => calcSensitivity(input), [input]);

  return (
    <div className="space-y-8">
      {METRICS.map((metric) => (
        <div key={metric.key}>
          <h4 className="text-sm font-semibold text-zinc-700 mb-2">
            {metric.label} ({metric.unit}) — 변수별 영향
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-800 text-white">
                  <th className="text-left px-3 py-2 font-medium w-32">변수</th>
                  {DELTA_LABELS.map((lbl, i) => (
                    <th
                      key={i}
                      className={`text-center px-3 py-2 font-medium w-24 ${i === 2 ? 'bg-zinc-600' : ''}`}
                    >
                      {lbl}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.map((row, ri) => {
                  const baseScenario = row.scenarios[2]; // delta=0
                  const baseVal = baseScenario[metric.key];
                  return (
                    <tr
                      key={row.paramKey}
                      className={`border-b border-zinc-200 ${ri % 2 === 0 ? 'bg-white' : 'bg-zinc-50'}`}
                    >
                      <td className="px-3 py-2 text-zinc-700 font-medium">{row.label}</td>
                      {row.scenarios.map((scenario, si) => {
                        const val = scenario[metric.key];
                        const isBase = SENSITIVITY_DELTAS[si] === 0;
                        const colorClass = cellColor(val, baseVal, metric.higherIsBetter, isBase);
                        return (
                          <td key={si} className={`text-center px-3 py-2 ${colorClass}`}>
                            {metric.fmt(scenario)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <p className="text-xs text-zinc-500">
        * 기준값 대비 <span className="text-green-700 font-medium">초록 = 개선</span>,{' '}
        <span className="text-red-700 font-medium">빨강 = 악화</span>. 각 변수는 독립적으로 변동
        (다른 변수는 기준값 유지).
      </p>
    </div>
  );
}
