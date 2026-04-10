'use client';

/**
 * Phase 9-1 — 민감도 분석 토네이도 차트.
 *
 * 5개 변수 각각 ±20% 시나리오에서 NPV·IRR·회수기간의 변동폭을 수평 막대로 표시.
 * 막대 폭이 넓을수록 위에 배치(토네이도 형태).
 *
 * 스택 구조: [투명 오프셋] + [낮은구간] + [높은구간]
 *   - higherIsBetter 지표: 낮은구간=빨강, 높은구간=초록
 *   - lowerIsBetter 지표: 낮은구간=초록, 높은구간=빨강
 */
import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Tooltip } from 'recharts';
import {
  calcSensitivity,
  type SensitivityInput,
  type ScenarioResult,
} from '@/lib/calc/sensitivity';

// ─────────────────────────────────────────────────────────────
// 상수 & 타입
// ─────────────────────────────────────────────────────────────

const CHART_WIDTH = 600;
const CHART_HEIGHT = 260;
const BAR_SIZE = 28;
const NULL_PAYBACK_PROXY = 50; // 미회수 → 50년으로 대체 표시

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
  spacer: number;
  lowerSeg: number;
  upperSeg: number;
  /** 툴팁용 실제 값 */
  low: number;
  high: number;
  base: number;
}

function buildChartData(
  rows: ReturnType<typeof calcSensitivity>,
  mc: MetricConfig,
): { data: TornadoRow[]; refX: number; domainMin: number; domainMax: number } {
  const mapped = rows.map((row) => {
    const base = mc.getVal(row.scenarios[2]);
    const s0 = mc.getVal(row.scenarios[0]);
    const s4 = mc.getVal(row.scenarios[4]);
    const low = Math.min(s0, s4);
    const high = Math.max(s0, s4);
    return { label: row.label, base, low, high, span: high - low };
  });

  // 변동폭 내림차순 정렬 → 토네이도 형태
  mapped.sort((a, b) => b.span - a.span);

  const globalMin = Math.min(...mapped.map((r) => r.low));
  const globalMax = Math.max(...mapped.map((r) => r.high));
  const pad = Math.max((globalMax - globalMin) * 0.08, Math.abs(globalMax) * 0.01);
  const domainMin = globalMin - pad;
  const domainMax = globalMax + pad;

  const baseVal = mapped[0]?.base ?? 0;
  const refX = baseVal - domainMin;

  const data: TornadoRow[] = mapped.map((r) => {
    const spacer = r.low - domainMin;
    const lowerSeg = r.base - r.low; // base 미만 구간
    const upperSeg = r.high - r.base; // base 초과 구간
    return { label: r.label, spacer, lowerSeg, upperSeg, low: r.low, high: r.high, base: r.base };
  });

  return { data, refX, domainMin, domainMax };
}

// ─────────────────────────────────────────────────────────────
// 커스텀 툴팁
// ─────────────────────────────────────────────────────────────

interface CustomTooltipPayloadItem {
  payload: TornadoRow;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
  mc: MetricConfig;
}

function CustomTooltip({ active, payload, mc }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-zinc-200 bg-white px-3 py-2 text-xs shadow">
      <p className="font-semibold text-zinc-800 mb-1">{row.label}</p>
      <p className="text-zinc-600">
        기준: <span className="font-medium text-zinc-900">{mc.fmtTip(row.base)}</span>
      </p>
      <p className="text-red-600">
        −20%: <span className="font-medium">{mc.fmtTip(row.low)}</span>
      </p>
      <p className="text-green-700">
        +20%: <span className="font-medium">{mc.fmtTip(row.high)}</span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

interface Props {
  input: SensitivityInput;
}

export function TornadoChart({ input }: Props) {
  const [metric, setMetric] = useState<Metric>('npv');
  const analysis = useMemo(() => calcSensitivity(input), [input]);
  const mc = METRICS.find((m) => m.key === metric)!;

  const { data, refX, domainMin, domainMax } = useMemo(
    () => buildChartData(analysis, mc),
    [analysis, mc],
  );

  // higherIsBetter: lowerSeg=빨강(악화), upperSeg=초록(개선)
  // lowerIsBetter:  lowerSeg=초록(개선), upperSeg=빨강(악화)
  const lowerColor = mc.higherIsBetter ? '#fca5a5' : '#86efac'; // red-300 : green-300
  const upperColor = mc.higherIsBetter ? '#86efac' : '#fca5a5'; // green-300 : red-300
  const lowerStroke = mc.higherIsBetter ? '#dc2626' : '#16a34a';
  const upperStroke = mc.higherIsBetter ? '#16a34a' : '#dc2626';

  const domainRange = domainMax - domainMin;

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
      <div className="overflow-x-auto">
        <BarChart
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, bottom: 8, left: 90 }}
        >
          <XAxis
            type="number"
            domain={[0, domainRange]}
            tickCount={6}
            tickFormatter={(v: number) => mc.fmtAxis(v + domainMin)}
            tick={{ fontSize: 10 }}
          />
          <YAxis type="category" dataKey="label" width={84} tick={{ fontSize: 11 }} />
          <Tooltip
            content={(props) => (
              <CustomTooltip
                active={props.active}
                payload={props.payload as unknown as CustomTooltipPayloadItem[] | undefined}
                mc={mc}
              />
            )}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          />

          {/* 투명 오프셋 (위치 조정용) */}
          <Bar
            dataKey="spacer"
            stackId="t"
            fill="transparent"
            stroke="none"
            isAnimationActive={false}
            barSize={BAR_SIZE}
            legendType="none"
          />

          {/* 낮은 구간 (base 미만) */}
          <Bar
            dataKey="lowerSeg"
            stackId="t"
            fill={lowerColor}
            stroke={lowerStroke}
            strokeWidth={0.5}
            isAnimationActive={false}
            barSize={BAR_SIZE}
            legendType="none"
          />

          {/* 높은 구간 (base 초과) */}
          <Bar
            dataKey="upperSeg"
            stackId="t"
            fill={upperColor}
            stroke={upperStroke}
            strokeWidth={0.5}
            isAnimationActive={false}
            barSize={BAR_SIZE}
            radius={[0, 3, 3, 0]}
            legendType="none"
          />

          {/* 기준값 참조선 */}
          <ReferenceLine x={refX} stroke="#3f3f46" strokeWidth={1.5} strokeDasharray="4 3" />
        </BarChart>
      </div>

      {/* 범례 */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: upperColor, border: `1px solid ${upperStroke}` }}
          />
          {mc.higherIsBetter ? '개선 (+20%)' : '개선 (−20%)'}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: lowerColor, border: `1px solid ${lowerStroke}` }}
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
