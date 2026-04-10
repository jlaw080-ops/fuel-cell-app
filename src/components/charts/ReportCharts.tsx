'use client';

/**
 * Phase 6b — 리포트 차트.
 *
 * 결과/리포트 양쪽에서 사용. recharts 기반 SVG → 인쇄 시 깨끗.
 *   1) 월별 발전량 (중간/최대 누적 막대)
 *   2) 월별 수익 (발전/열/가스요금/최종)
 *   3) 연도별 누적 현금흐름 (라인)
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ReportSnapshot } from '@/lib/schemas/report';

const numFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const fmt = (v: number | string) => (typeof v === 'number' ? numFmt.format(v) : v);
const r0 = (n: number | null | undefined): number => Math.round(n ?? 0);

// 고정 px — 화면/인쇄 동일 렌더(ResponsiveContainer 미사용).
// isAnimationActive={false} 필수: 인쇄 시 애니메이션 시작 프레임(0%)에서 캡처되어
// SVG 막대/라인이 보이지 않는 버그 방지.
const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;

interface Props {
  snapshot: Pick<ReportSnapshot, 'results'>;
  /** @deprecated 미사용. */
  forPrint?: boolean;
}

export function ReportCharts({ snapshot }: Props) {
  const { production, revenue, economics } = snapshot.results;

  const monthlyEnergy = production.데이터.map((r) => ({
    월: `${r.월}월`,
    중간부하: r0(r.월간_중간부하시간_전력생산량_kWh),
    최대부하: r0(r.월간_최대부하시간_전력생산량_kWh),
    열생산: r0(r.월간_연료전지_열생산량_kWh),
  }));

  const monthlyRevenue = revenue.데이터.map((r) => ({
    월: `${r.월}월`,
    발전수익: r0(r.발전_월간총수익_원),
    열수익: r0(r.열생산_월간총수익_원),
    가스요금: -r0(r.도시가스사용요금_원 ?? 0),
    최종수익: r0(r.에너지생산_최종수익_원),
  }));

  const yearlyCum = economics.annual.데이터.map((r) => ({
    연도: `${r.연도}년`,
    누적순현금흐름: r0(r.누적순현금흐름_원),
    할인누적: r0(r.할인순현금흐름_원),
  }));

  return (
    <div className="space-y-6">
      <ChartCard title="월별 에너지 생산량 (kWh)">
        <BarChart data={monthlyEnergy} width={CHART_WIDTH} height={CHART_HEIGHT}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="월" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v) => fmt(v as number)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="중간부하" stackId="elec" fill="#60a5fa" isAnimationActive={false} />
          <Bar dataKey="최대부하" stackId="elec" fill="#2563eb" isAnimationActive={false} />
          <Bar dataKey="열생산" fill="#f59e0b" isAnimationActive={false} />
        </BarChart>
      </ChartCard>

      <ChartCard title="월별 에너지 수익 (원)">
        <BarChart data={monthlyRevenue} width={CHART_WIDTH} height={CHART_HEIGHT}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="월" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v) => fmt(v as number)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="발전수익" fill="#2563eb" isAnimationActive={false} />
          <Bar dataKey="열수익" fill="#f59e0b" isAnimationActive={false} />
          <Bar dataKey="가스요금" fill="#dc2626" isAnimationActive={false} />
          <Bar dataKey="최종수익" fill="#16a34a" isAnimationActive={false} />
        </BarChart>
      </ChartCard>

      <ChartCard title="연도별 누적 현금흐름 (원)">
        <LineChart data={yearlyCum} width={CHART_WIDTH} height={CHART_HEIGHT}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="연도" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v) => fmt(v as number)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line
            type="monotone"
            dataKey="누적순현금흐름"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="할인누적"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-zinc-200 rounded p-4 bg-white">
      <h4 className="text-sm font-semibold mb-2 text-zinc-700">{title}</h4>
      <div className="chart-scroll-wrapper" style={{ overflowX: 'auto' }}>
        {children}
      </div>
    </div>
  );
}
