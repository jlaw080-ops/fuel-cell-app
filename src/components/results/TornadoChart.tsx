'use client';

/**
 * Phase 9-1 — 민감도 분석 토네이도 차트.
 *
 * 5개 변수 각각 ±20% 시나리오에서 NPV·IRR·회수기간의 변동폭을 수평 막대로 표시.
 * 막대 폭이 넓을수록 위에 배치(토네이도 형태).
 *
 * recharts 대신 순수 SVG로 구현하여 버전 호환성 문제를 회피.
 */
import { useMemo, useState } from 'react';
import {
  calcSensitivity,
  type SensitivityInput,
  type ScenarioResult,
} from '@/lib/calc/sensitivity';

// ─────────────────────────────────────────────────────────────
// 상수 & 타입
// ─────────────────────────────────────────────────────────────

const CHART_WIDTH = 560;
const BAR_H = 24;
const BAR_GAP = 10;
const LABEL_W = 80;
const AXIS_H = 24;
const V_PAD = 8;
const NULL_PAYBACK_PROXY = 50;

type Metric = 'npv' | 'irr' | 'payback';

interface MetricConfig {
  key: Metric;
  label: string;
  higherIsBetter: boolean;
  getVal: (s: ScenarioResult) => number;
  fmtAxis: (v: number) => string;
  fmtTip: (v: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'npv',
    label: 'NPV',
    higherIsBetter: true,
    getVal: (s) => s.npv ?? 0,
    fmtAxis: (v) => `${(v / 1e8).toFixed(1)}억`,
    fmtTip: (v) => `${(v / 1e8).toFixed(2)}억원`,
  },
  {
    key: 'irr',
    label: 'IRR',
    higherIsBetter: true,
    getVal: (s) => s.irr ?? 0,
    fmtAxis: (v) => `${(v * 100).toFixed(1)}%`,
    fmtTip: (v) => `${(v * 100).toFixed(2)}%`,
  },
  {
    key: 'payback',
    label: '회수기간',
    higherIsBetter: false,
    getVal: (s) => s.payback ?? NULL_PAYBACK_PROXY,
    fmtAxis: (v) => (v >= NULL_PAYBACK_PROXY ? '미회수' : `${v.toFixed(1)}년`),
    fmtTip: (v) => (v >= NULL_PAYBACK_PROXY ? '미회수' : `${v.toFixed(2)}년`),
  },
];

// ─────────────────────────────────────────────────────────────
// 차트 데이터 계산
// ─────────────────────────────────────────────────────────────

interface TornadoRow {
  label: string;
  low: number;
  high: number;
  base: number;
  span: number;
}

function buildRows(rows: ReturnType<typeof calcSensitivity>, mc: MetricConfig): TornadoRow[] {
  const mapped: TornadoRow[] = rows.map((row) => {
    const base = mc.getVal(row.scenarios[2]);
    const s0 = mc.getVal(row.scenarios[0]);
    const s4 = mc.getVal(row.scenarios[4]);
    const low = Math.min(s0, s4);
    const high = Math.max(s0, s4);
    return { label: row.label, base, low, high, span: high - low };
  });
  mapped.sort((a, b) => b.span - a.span);
  return mapped;
}

function buildDomain(rows: TornadoRow[]): { domainMin: number; domainMax: number } {
  const globalMin = Math.min(...rows.map((r) => r.low));
  const globalMax = Math.max(...rows.map((r) => r.high));
  const range = globalMax - globalMin;
  const pad = Math.max(range * 0.08, Math.abs(globalMax) * 0.01, 1e-9);
  return { domainMin: globalMin - pad, domainMax: globalMax + pad };
}

// ─────────────────────────────────────────────────────────────
// 축 눈금 계산 (약 5개)
// ─────────────────────────────────────────────────────────────

function niceTicks(domainMin: number, domainMax: number, count = 5): number[] {
  const range = domainMax - domainMin;
  if (range <= 0) return [domainMin];
  const rawStep = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rawStep))));
  const niceSteps = [1, 2, 2.5, 5, 10];
  let step = magnitude;
  for (const s of niceSteps) {
    if (s * magnitude >= rawStep) {
      step = s * magnitude;
      break;
    }
  }
  const first = Math.ceil(domainMin / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= domainMax + step * 0.01; t += step) {
    ticks.push(parseFloat(t.toPrecision(10)));
  }
  return ticks;
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

interface Props {
  input: SensitivityInput;
}

export function TornadoChart({ input }: Props) {
  const [metric, setMetric] = useState<Metric>('npv');
  const [tooltip, setTooltip] = useState<{
    row: TornadoRow;
    x: number;
    y: number;
  } | null>(null);

  const analysis = useMemo(() => calcSensitivity(input), [input]);
  const mc = METRICS.find((m) => m.key === metric)!;
  const rows = useMemo(() => buildRows(analysis, mc), [analysis, mc]);
  const { domainMin, domainMax } = useMemo(() => buildDomain(rows), [rows]);

  const plotW = CHART_WIDTH - LABEL_W;
  const chartH = rows.length * (BAR_H + BAR_GAP) + V_PAD * 2 + AXIS_H;

  const toX = (v: number) => ((v - domainMin) / (domainMax - domainMin)) * plotW;
  const baseX = toX(rows[0]?.base ?? domainMin);

  const lowerFill = mc.higherIsBetter ? '#fca5a5' : '#86efac';
  const upperFill = mc.higherIsBetter ? '#86efac' : '#fca5a5';
  const lowerStroke = mc.higherIsBetter ? '#dc2626' : '#16a34a';
  const upperStroke = mc.higherIsBetter ? '#16a34a' : '#dc2626';

  const ticks = useMemo(() => niceTicks(domainMin, domainMax, 5), [domainMin, domainMax]);

  return (
    <div className="space-y-3">
      {/* 지표 선택 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">지표:</span>
        <div className="flex rounded border border-zinc-300 overflow-hidden text-xs font-medium">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={`px-3 py-1 ${
                metric === m.key
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* 차트 */}
      <div className="overflow-x-auto relative">
        <svg
          width={CHART_WIDTH}
          height={chartH}
          style={{ overflow: 'visible', userSelect: 'none' }}
        >
          {/* Y축 레이블 + 막대 */}
          {rows.map((row, i) => {
            const barY = V_PAD + i * (BAR_H + BAR_GAP);
            const barCenterY = barY + BAR_H / 2;
            const lowX = toX(row.low);
            const highX = toX(row.high);
            const baseXRow = toX(row.base);

            // 왼쪽 세그먼트: low → base
            const leftX = Math.min(lowX, baseXRow);
            const leftW = Math.abs(baseXRow - lowX);
            // 오른쪽 세그먼트: base → high
            const rightX = Math.min(highX, baseXRow);
            const rightW = Math.abs(highX - baseXRow);

            const leftFill = row.low < row.base ? lowerFill : upperFill;
            const leftStr = row.low < row.base ? lowerStroke : upperStroke;
            const rightFill = row.high > row.base ? upperFill : lowerFill;
            const rightStr = row.high > row.base ? upperStroke : lowerStroke;

            return (
              <g key={row.label}>
                {/* 레이블 */}
                <text
                  x={LABEL_W - 6}
                  y={barCenterY + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="#52525b"
                >
                  {row.label}
                </text>

                {/* 왼쪽 막대 (low → base) */}
                {leftW > 0 && (
                  <rect
                    x={LABEL_W + leftX}
                    y={barY}
                    width={leftW}
                    height={BAR_H}
                    fill={leftFill}
                    stroke={leftStr}
                    strokeWidth={0.5}
                    rx={2}
                    onMouseEnter={(e) => {
                      const svg = e.currentTarget.closest('svg')!;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        row,
                        x: e.clientX - rect.left,
                        y: barY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: 'default' }}
                  />
                )}

                {/* 오른쪽 막대 (base → high) */}
                {rightW > 0 && (
                  <rect
                    x={LABEL_W + rightX}
                    y={barY}
                    width={rightW}
                    height={BAR_H}
                    fill={rightFill}
                    stroke={rightStr}
                    strokeWidth={0.5}
                    rx={2}
                    onMouseEnter={(e) => {
                      const svg = e.currentTarget.closest('svg')!;
                      const rect = svg.getBoundingClientRect();
                      setTooltip({
                        row,
                        x: e.clientX - rect.left,
                        y: barY,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{ cursor: 'default' }}
                  />
                )}
              </g>
            );
          })}

          {/* 기준선 */}
          <line
            x1={LABEL_W + baseX}
            y1={V_PAD}
            x2={LABEL_W + baseX}
            y2={chartH - AXIS_H}
            stroke="#3f3f46"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />

          {/* X축 */}
          {ticks.map((t) => {
            const tx = toX(t);
            if (tx < -2 || tx > plotW + 2) return null;
            return (
              <g key={t}>
                <line
                  x1={LABEL_W + tx}
                  y1={chartH - AXIS_H}
                  x2={LABEL_W + tx}
                  y2={chartH - AXIS_H + 4}
                  stroke="#d4d4d8"
                  strokeWidth={1}
                />
                <text
                  x={LABEL_W + tx}
                  y={chartH - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#71717a"
                >
                  {mc.fmtAxis(t)}
                </text>
              </g>
            );
          })}

          {/* X축 베이스 라인 */}
          <line
            x1={LABEL_W}
            y1={chartH - AXIS_H}
            x2={LABEL_W + plotW}
            y2={chartH - AXIS_H}
            stroke="#d4d4d8"
            strokeWidth={1}
          />
        </svg>

        {/* 툴팁 */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 rounded border border-zinc-200 bg-white px-3 py-2 text-xs shadow"
            style={{ left: tooltip.x + 8, top: tooltip.y }}
          >
            <p className="font-semibold text-zinc-800 mb-1">{tooltip.row.label}</p>
            <p className="text-zinc-600">
              기준: <span className="font-medium text-zinc-900">{mc.fmtTip(tooltip.row.base)}</span>
            </p>
            <p className="text-red-600">
              −20%: <span className="font-medium">{mc.fmtTip(tooltip.row.low)}</span>
            </p>
            <p className="text-green-700">
              +20%: <span className="font-medium">{mc.fmtTip(tooltip.row.high)}</span>
            </p>
          </div>
        )}
      </div>

      {/* 범례 */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: upperFill, border: `1px solid ${upperStroke}` }}
          />
          {mc.higherIsBetter ? '개선 (+20%)' : '개선 (−20%)'}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: lowerFill, border: `1px solid ${lowerStroke}` }}
          />
          {mc.higherIsBetter ? '악화 (−20%)' : '악화 (+20%)'}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-5 border-t border-dashed border-zinc-500" />
          기준값
        </span>
      </div>
    </div>
  );
}
