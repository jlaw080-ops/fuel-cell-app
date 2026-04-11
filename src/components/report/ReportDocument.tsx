'use client';

/**
 * Phase 10 — 리포트 본문 (A4 세로형).
 *
 * 섹션 구조:
 *   표지     핵심 지표 카드 + 분석 조건 요약
 *   1        입력 정보 (연료전지 세트 · 운전 프로파일)
 *   2        에너지 생산량 / 사용량 (월별)
 *   3        에너지 생산 수익 (월별)
 *   4        경제성 분석 (연도별 현금흐름 + 기간별 요약)
 *   5        시각화 (ReportCharts)
 *   6        민감도 분석 — 토네이도 차트 + NPV/IRR/회수기간 테이블 (조건부)
 *   7        수익성 지도 — CAPEX × 발전수익 히트맵 (조건부)
 *   8        AI 검토 의견
 */
import type { ReportSnapshot } from '@/lib/schemas/report';
import { fmtWon, fmtWonPerKWh, fmtYears, fmtPct, fmtKW, fmtKWh, fmtInt } from '@/lib/format';
import { ReportCharts } from '@/components/charts/ReportCharts';
import { calcSensitivity, SENSITIVITY_DELTAS } from '@/lib/calc/sensitivity';
import {
  calcProfitabilityMap,
  BASE_FACTOR_IDX,
  type ProfitabilityMapInput,
} from '@/lib/calc/profitabilityMap';

const nf0Sen = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const nf2Sen = new Intl.NumberFormat('ko-KR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 1,
});
const DELTA_LABELS_SEN = ['-20%', '-10%', '기준', '+10%', '+20%'];

// ─────────────────────────────────────────────────────────────
// Static visualization helpers (PDF — no hooks, no interactivity)
// ─────────────────────────────────────────────────────────────

function StaticTornadoChart({ data }: { data: ReturnType<typeof calcSensitivity> }) {
  const CHART_W = 420;
  const LABEL_W = 88;
  const BAR_H = 20;
  const BAR_GAP = 7;
  const PAD_TOP = 4;

  const rows = data
    .map((row) => ({
      label: row.label,
      low: row.scenarios[0].npv ?? 0,
      high: row.scenarios[4].npv ?? 0,
      base: row.scenarios[2].npv ?? 0,
    }))
    .sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));

  const allVals = rows.flatMap((r) => [r.low, r.high]);
  const dataMin = Math.min(...allVals);
  const dataMax = Math.max(...allVals);
  const span = dataMax - dataMin || 1;
  const totalH = PAD_TOP + rows.length * (BAR_H + BAR_GAP);
  const svgH = totalH + 36;

  function xPos(v: number) {
    return LABEL_W + ((v - dataMin) / span) * CHART_W;
  }
  const baseX = xPos(rows[0]?.base ?? 0);

  function fmtVal(v: number) {
    const m = Math.abs(v);
    if (m >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
    if (m >= 1e4) return `${Math.round(v / 1e4)}만`;
    return String(Math.round(v));
  }

  return (
    <svg width={LABEL_W + CHART_W} height={svgH} style={{ display: 'block', maxWidth: '100%' }}>
      <line
        x1={baseX}
        y1={0}
        x2={baseX}
        y2={totalH}
        stroke="#9ca3af"
        strokeWidth={1}
        strokeDasharray="3,3"
      />
      {rows.map((row, i) => {
        const y = PAD_TOP + i * (BAR_H + BAR_GAP);
        const x1 = xPos(Math.min(row.low, row.high));
        const x2 = xPos(Math.max(row.low, row.high));
        const bx = xPos(row.base);
        const leftW = Math.max(bx - x1, 0);
        const rightW = Math.max(x2 - bx, 0);
        return (
          <g key={row.label}>
            {leftW > 0 && (
              <rect x={x1} y={y} width={leftW} height={BAR_H} fill="#ef4444" opacity={0.7} />
            )}
            {rightW > 0 && (
              <rect x={bx} y={y} width={rightW} height={BAR_H} fill="#22c55e" opacity={0.7} />
            )}
            <text
              x={LABEL_W - 4}
              y={y + BAR_H / 2 + 4}
              textAnchor="end"
              fontSize={9}
              fill="#374151"
            >
              {row.label}
            </text>
          </g>
        );
      })}
      {[0, 0.5, 1].map((t) => {
        const val = dataMin + t * span;
        const x = LABEL_W + t * CHART_W;
        return (
          <text key={t} x={x} y={totalH + 14} textAnchor="middle" fontSize={8} fill="#6b7280">
            {fmtVal(val)}
          </text>
        );
      })}
      <rect x={LABEL_W} y={totalH + 22} width={8} height={7} fill="#ef4444" opacity={0.7} />
      <text x={LABEL_W + 11} y={totalH + 29} fontSize={8} fill="#6b7280">
        불리 방향
      </text>
      <rect x={LABEL_W + 68} y={totalH + 22} width={8} height={7} fill="#22c55e" opacity={0.7} />
      <text x={LABEL_W + 79} y={totalH + 29} fontSize={8} fill="#6b7280">
        유리 방향
      </text>
    </svg>
  );
}

function StaticProfitabilityMap({ input }: { input: ProfitabilityMapInput }) {
  const result = calcProfitabilityMap(input);
  const { cells, capexFactors, elecFactors, baseCapex, lifetime } = result;

  const CELL_W = 42;
  const CELL_H = 22;
  const Y_LBL = 52;
  const X_LBL_H = 30;
  const gridW = capexFactors.length * CELL_W;
  const gridH = elecFactors.length * CELL_H;
  const svgW = Y_LBL + gridW;
  const svgH = gridH + X_LBL_H + 18;

  const allNpv = cells
    .flat()
    .map((c) => c.npv)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const vMin = allNpv.length ? Math.min(...allNpv) : 0;
  const vMax = allNpv.length ? Math.max(...allNpv) : 1;

  function cellFill(npvVal: number | null): string {
    if (npvVal == null || !Number.isFinite(npvVal) || vMin === vMax) return '#e5e7eb';
    const t = (npvVal - vMin) / (vMax - vMin);
    if (t >= 0.5) {
      const s = (t - 0.5) * 2;
      return `rgb(${Math.round(255 - 221 * s)},${Math.round(255 - 58 * s)},${Math.round(255 - 161 * s)})`;
    } else {
      const s = (0.5 - t) * 2;
      return `rgb(${Math.round(255 - 16 * s)},${Math.round(255 - 187 * s)},${Math.round(255 - 187 * s)})`;
    }
  }

  const baseRowIdx = elecFactors.length - 1 - BASE_FACTOR_IDX;
  const baseColIdx = BASE_FACTOR_IDX;

  return (
    <svg width={svgW} height={svgH} style={{ display: 'block', maxWidth: '100%' }}>
      <defs>
        <linearGradient id="pm-legend" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="50%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
      </defs>
      <text x={Y_LBL - 4} y={10} textAnchor="end" fontSize={8} fill="#6b7280">
        발전수익
      </text>
      {elecFactors.map((f, i) => (
        <text
          key={f}
          x={Y_LBL - 4}
          y={i * CELL_H + CELL_H / 2 + 4}
          textAnchor="end"
          fontSize={8}
          fill="#6b7280"
        >
          {`${Math.round(f * 100)}%`}
        </text>
      ))}
      {cells.map((row, rowIdx) =>
        row.map((cell, colIdx) => {
          const x = Y_LBL + colIdx * CELL_W;
          const y = rowIdx * CELL_H;
          const isBase = rowIdx === baseRowIdx && colIdx === baseColIdx;
          const npvStr =
            cell.npv == null || !Number.isFinite(cell.npv)
              ? '-'
              : `${(cell.npv / 1e8).toFixed(1)}억`;
          return (
            <g key={`${rowIdx}-${colIdx}`}>
              <rect
                x={x}
                y={y}
                width={CELL_W}
                height={CELL_H}
                fill={cellFill(cell.npv)}
                stroke={isBase ? '#18181b' : 'rgba(0,0,0,0.08)'}
                strokeWidth={isBase ? 2 : 0.5}
              />
              <text
                x={x + CELL_W / 2}
                y={y + CELL_H / 2 + 4}
                textAnchor="middle"
                fontSize={7}
                fontWeight={isBase ? 700 : 400}
                fill="rgba(0,0,0,0.65)"
              >
                {npvStr}
              </text>
            </g>
          );
        }),
      )}
      {capexFactors.map((f, i) => {
        const x = Y_LBL + i * CELL_W + CELL_W / 2;
        const val = (baseCapex * f) / 1e8;
        const lbl = val >= 10 ? `${val.toFixed(0)}억` : `${val.toFixed(1)}억`;
        return (
          <text key={f} x={x} y={gridH + 14} textAnchor="middle" fontSize={7} fill="#6b7280">
            {lbl}
          </text>
        );
      })}
      <text x={Y_LBL + gridW / 2} y={gridH + 26} textAnchor="middle" fontSize={8} fill="#6b7280">
        CAPEX
      </text>
      <text x={Y_LBL} y={gridH + X_LBL_H + 10} fontSize={7} fill="#6b7280">
        NPV 낮음
      </text>
      <rect
        x={Y_LBL + 42}
        y={gridH + X_LBL_H + 2}
        width={80}
        height={8}
        fill="url(#pm-legend)"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={0.5}
      />
      <text x={Y_LBL + 126} y={gridH + X_LBL_H + 10} fontSize={7} fill="#6b7280">
        높음
      </text>
      <text x={Y_LBL + 180} y={gridH + X_LBL_H + 10} fontSize={7} fill="#6b7280">
        (분석기간: {lifetime}년, ■ 기준 셀)
      </text>
    </svg>
  );
}

interface Props {
  snapshot: ReportSnapshot;
  aiReview: string | null;
  aiLoading: boolean;
  aiSkipped: boolean;
}

export function ReportDocument({ snapshot, aiReview, aiLoading, aiSkipped }: Props) {
  const { inputs, settings, results, meta } = snapshot;
  const e = results.economics;
  const summary20 = e.summary.데이터.find((r) => r.기간_년 === 20);
  const createdAt = new Date(meta.createdAt).toLocaleString('ko-KR');

  const baseMaintFallback =
    e.baseAnnualMaintenance ?? (e.capex != null ? e.capex * settings.maintenanceRatio : null);

  const sensitivityInput =
    e.capex != null &&
    baseMaintFallback != null &&
    results.revenue.합계.발전_월간총수익_원 != null &&
    results.revenue.합계.열생산_월간총수익_원 != null &&
    results.revenue.합계.도시가스사용요금_원 != null
      ? {
          capex: e.capex,
          baseElecRev: results.revenue.합계.발전_월간총수익_원,
          baseHeatRev: results.revenue.합계.열생산_월간총수익_원,
          baseGasCost: results.revenue.합계.도시가스사용요금_원,
          baseMaint: baseMaintFallback,
          maintenanceMode: settings.maintenanceMode,
          lifetime: settings.lifetime,
          discountRate: settings.discountRate,
          electricityEscalation: settings.electricityEscalation,
          gasEscalation: settings.gasEscalation,
          maintenanceEscalation: settings.maintenanceEscalation,
        }
      : null;

  const sensitivityData = sensitivityInput ? calcSensitivity(sensitivityInput) : null;
  const profitabilityMapInput: ProfitabilityMapInput | null = sensitivityInput;

  return (
    <div className="report-root">
      {/* 1. 표지/요약 */}
      <section className="report-page">
        <h1>연료전지 경제성 분석 리포트</h1>
        <div className="report-meta">작성일시: {createdAt}</div>

        <h2>핵심 지표</h2>
        <div className="report-cards">
          <div className="report-card">
            <div className="label">초기투자비 (CAPEX)</div>
            <div className="value">{fmtWon(e.capex)}</div>
          </div>
          <div className="report-card">
            <div className="label">LCOE (전기)</div>
            <div className="value">{fmtWonPerKWh(e.lcoe_원per_kWh)}</div>
          </div>
          <div className="report-card">
            <div className="label">회수기간 (단순)</div>
            <div className="value">
              {results.paybackYears == null ? '회수 불가' : fmtYears(results.paybackYears)}
            </div>
          </div>
          <div className="report-card">
            <div className="label">기준 연간 유지보수비</div>
            <div className="value">{fmtWon(e.baseAnnualMaintenance)}</div>
          </div>
          <div className="report-card">
            <div className="label">20년 NPV</div>
            <div className="value">{fmtWon(summary20?.NPV_원)}</div>
          </div>
          <div className="report-card">
            <div className="label">20년 IRR</div>
            <div className="value">{fmtPct(summary20?.IRR)}</div>
          </div>
        </div>

        <h3>분석 조건</h3>
        <table>
          <tbody>
            <tr>
              <th>분석기간</th>
              <td>{settings.lifetime} 년</td>
              <th>할인율 (명목)</th>
              <td>{fmtPct(settings.discountRate)}</td>
            </tr>
            <tr>
              <th>유지보수 모드</th>
              <td>{settings.maintenanceMode === 'fixedCost' ? '라이브러리 단가' : '비율'}</td>
              <th>유지보수 비율</th>
              <td>{fmtPct(settings.maintenanceRatio)}</td>
            </tr>
            <tr>
              <th>전기 상승률</th>
              <td>{fmtPct(settings.electricityEscalation)}</td>
              <th>가스 상승률</th>
              <td>{fmtPct(settings.gasEscalation)}</td>
            </tr>
            <tr>
              <th>유지비 상승률</th>
              <td>{fmtPct(settings.maintenanceEscalation)}</td>
              <th>보일러 효율</th>
              <td>{fmtPct(settings.boilerEfficiency)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 2. 입력 요약 */}
      <section className="report-page">
        <h2>1. 입력 정보</h2>

        <h3>연료전지 세트 ({inputs.fuelCell.총설치용량_kW} kW 총 설치)</h3>
        <table>
          <thead>
            <tr>
              <th>형식</th>
              <th>제조사</th>
              <th>모델</th>
              <th>발전용량</th>
              <th>열생산용량</th>
              <th>수량</th>
            </tr>
          </thead>
          <tbody>
            {inputs.fuelCell.sets.map((s) => (
              <tr key={s.set_id}>
                <td>{s.형식 ?? '-'}</td>
                <td>{s.제조사 ?? '-'}</td>
                <td>{s.모델 ?? '-'}</td>
                <td>{fmtKW(s.발전용량_kW)}</td>
                <td>{fmtKW(s.열생산용량_kW)}</td>
                <td>{s.설치수량 ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>운전 프로파일</h3>
        <table>
          <tbody>
            <tr>
              <th>연간 운전유형</th>
              <td>{inputs.operation.연간운전유형 ?? '-'}</td>
              <th>연간 가동일</th>
              <td>{inputs.operation.연간운전일수 ?? '-'} 일</td>
            </tr>
            <tr>
              <th>일일 중간부하</th>
              <td>{inputs.operation.일일_중간부하_운전시간} h</td>
              <th>일일 최대부하</th>
              <td>{inputs.operation.일일_최대부하_운전시간} h</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3. 에너지 산출 */}
      <section className="report-page">
        <h2>2. 에너지 생산량 / 사용량 (월별)</h2>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>일수</th>
              <th>중간부하 발전</th>
              <th>최대부하 발전</th>
              <th>열 생산</th>
              <th>가스 사용</th>
            </tr>
          </thead>
          <tbody>
            {results.production.데이터.map((r) => (
              <tr key={r.월}>
                <td>{r.월}월</td>
                <td>{fmtInt(r.일수)}</td>
                <td>{fmtKWh(r.월간_중간부하시간_전력생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_최대부하시간_전력생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_연료전지_열생산량_kWh)}</td>
                <td>{fmtKWh(r.월간_도시가스사용량_kWh)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>합계</td>
              <td>{fmtInt(results.production.합계.일수)}</td>
              <td>{fmtKWh(results.production.합계.월간_중간부하시간_전력생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_최대부하시간_전력생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_연료전지_열생산량_kWh)}</td>
              <td>{fmtKWh(results.production.합계.월간_도시가스사용량_kWh)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 4. 수익 */}
      <section className="report-page">
        <h2>3. 에너지 생산 수익 (월별)</h2>
        <table>
          <thead>
            <tr>
              <th>월</th>
              <th>일수</th>
              <th>발전 수익</th>
              <th>열 수익</th>
              <th>가스 요금</th>
              <th>최종 수익</th>
            </tr>
          </thead>
          <tbody>
            {results.revenue.데이터.map((r) => (
              <tr key={r.월}>
                <td>{r.월}월</td>
                <td>{fmtInt(r.일수)}</td>
                <td>{fmtWon(r.발전_월간총수익_원)}</td>
                <td>{fmtWon(r.열생산_월간총수익_원)}</td>
                <td>{fmtWon(r.도시가스사용요금_원)}</td>
                <td>{fmtWon(r.에너지생산_최종수익_원)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>합계</td>
              <td>{fmtInt(results.revenue.합계.일수)}</td>
              <td>{fmtWon(results.revenue.합계.발전_월간총수익_원)}</td>
              <td>{fmtWon(results.revenue.합계.열생산_월간총수익_원)}</td>
              <td>{fmtWon(results.revenue.합계.도시가스사용요금_원)}</td>
              <td>{fmtWon(results.revenue.합계.에너지생산_최종수익_원)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* 5. 경제성 */}
      <section className="report-page">
        <h2>4. 경제성 분석</h2>

        <h3>연도별 현금흐름 ({settings.lifetime}년)</h3>
        <table>
          <thead>
            <tr>
              <th>연도</th>
              <th>총수익</th>
              <th>유지비</th>
              <th>순현금흐름</th>
              <th>누적</th>
              <th>할인</th>
            </tr>
          </thead>
          <tbody>
            {e.annual.데이터.map((r) => (
              <tr key={r.연도}>
                <td>{r.연도}년</td>
                <td>{fmtWon(r.총수익_원)}</td>
                <td>{fmtWon(r.유지보수비용_원)}</td>
                <td>{fmtWon(r.순현금흐름_원)}</td>
                <td>{fmtWon(r.누적순현금흐름_원)}</td>
                <td>{fmtWon(r.할인순현금흐름_원)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>기간별 요약</h3>
        <table>
          <thead>
            <tr>
              <th>기간</th>
              <th>누적수익</th>
              <th>총비용</th>
              <th>ROI(투자)</th>
              <th>NPV</th>
              <th>IRR</th>
            </tr>
          </thead>
          <tbody>
            {e.summary.데이터.map((r) => (
              <tr key={r.기간_년}>
                <td>{r.기간_년}년</td>
                <td>{fmtWon(r.누적수익_원)}</td>
                <td>{fmtWon(r.총비용_원)}</td>
                <td>{fmtPct(r.ROI_초기투자)}</td>
                <td>{fmtWon(r.NPV_원)}</td>
                <td>{fmtPct(r.IRR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 6. 차트 */}
      <section className="report-page">
        <h2>5. 시각화</h2>
        <ReportCharts snapshot={snapshot} />
      </section>

      {/* 6. 민감도 분석 */}
      {sensitivityData && (
        <section className="report-page">
          <h2>6. 민감도 분석</h2>
          <p className="report-meta">
            주요 변수를 ±10% / ±20% 변동시켰을 때 경제성 지표의 변화를 보여줍니다. 각 변수는
            독립적으로 변동합니다 (다른 변수는 기준값 유지).
          </p>

          <h3>변수별 영향 — 토네이도 차트 (NPV 기준, ±20%)</h3>
          <StaticTornadoChart data={sensitivityData} />

          <h3>NPV (만원)</h3>
          <table>
            <thead>
              <tr>
                <th>변수</th>
                {DELTA_LABELS_SEN.map((l) => (
                  <th key={l}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityData.map((row) => (
                <tr key={row.paramKey}>
                  <td>{row.label}</td>
                  {row.scenarios.map((s, i) => (
                    <td
                      key={i}
                      style={{
                        textAlign: 'right',
                        fontWeight: SENSITIVITY_DELTAS[i] === 0 ? 'bold' : undefined,
                      }}
                    >
                      {s.npv == null || !Number.isFinite(s.npv)
                        ? '-'
                        : nf0Sen.format(Math.round(s.npv / 10000)) + '만'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h3>IRR (%)</h3>
          <table>
            <thead>
              <tr>
                <th>변수</th>
                {DELTA_LABELS_SEN.map((l) => (
                  <th key={l}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityData.map((row) => (
                <tr key={row.paramKey}>
                  <td>{row.label}</td>
                  {row.scenarios.map((s, i) => (
                    <td
                      key={i}
                      style={{
                        textAlign: 'right',
                        fontWeight: SENSITIVITY_DELTAS[i] === 0 ? 'bold' : undefined,
                      }}
                    >
                      {s.irr == null || !Number.isFinite(s.irr)
                        ? '-'
                        : `${nf2Sen.format(s.irr * 100)}%`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <h3>회수기간 (년)</h3>
          <table>
            <thead>
              <tr>
                <th>변수</th>
                {DELTA_LABELS_SEN.map((l) => (
                  <th key={l}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sensitivityData.map((row) => (
                <tr key={row.paramKey}>
                  <td>{row.label}</td>
                  {row.scenarios.map((s, i) => (
                    <td
                      key={i}
                      style={{
                        textAlign: 'right',
                        fontWeight: SENSITIVITY_DELTAS[i] === 0 ? 'bold' : undefined,
                      }}
                    >
                      {s.payback == null || !Number.isFinite(s.payback)
                        ? '미회수'
                        : `${nf2Sen.format(s.payback)}년`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 7. 수익성 지도 */}
      {profitabilityMapInput && (
        <section className="report-page">
          <h2>7. 수익성 지도</h2>
          <p className="report-meta">
            CAPEX와 발전수익을 ±50% 범위로 변동시켰을 때 NPV 변화를 2D 히트맵으로 표시합니다.
            붉은색은 낮은 NPV, 녹색은 높은 NPV를 나타내며, 굵은 테두리 셀이 기준값입니다.
          </p>
          <StaticProfitabilityMap input={profitabilityMapInput} />
        </section>
      )}

      {/* 8. AI 검토 */}
      <section className="report-page">
        <h2>8. AI 검토 의견</h2>
        {aiLoading && <p className="text-zinc-500">AI 검토 의견 생성 중...</p>}
        {aiReview && <p style={{ whiteSpace: 'pre-wrap' }}>{aiReview}</p>}
        {aiSkipped && !aiReview && (
          <p className="report-meta">
            AI 검토 기능이 비활성화되어 있습니다. (GEMINI_API_KEY 미설정 또는 API 오류)
          </p>
        )}
        {!aiLoading && !aiReview && !aiSkipped && (
          <p className="report-meta">
            AI 검토는 리포트를 서버에 저장한 경우에만 자동 생성됩니다. 임시 미리보기 모드에서는
            생략됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
