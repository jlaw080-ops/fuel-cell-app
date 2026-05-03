'use client';

/**
 * Phase 9-2 — 수익성 지도 (Profitability Map).
 *
 * CAPEX(x축) × 발전수익 배율(y축) 11×11 히트맵.
 * 각 셀을 NPV·IRR·회수기간에 따라 빨강→흰→초록 발산형 색상으로 표시.
 * 기준 셀(1.0×1.0)에 테두리 강조.
 */
import { useMemo, useState } from 'react';
import {
  calcProfitabilityMap,
  BASE_FACTOR_IDX,
  type ProfitabilityMapInput,
  type MapCell,
} from '@/lib/calc/profitabilityMap';

// ─────────────────────────────────────────────────────────────
// 상수 & 타입
// ─────────────────────────────────────────────────────────────

const CELL_W = 48;
const CELL_H = 32;
const Y_LABEL_W = 52;
const X_LABEL_H = 40;
const LEGEND_H = 28;

type Metric = 'npv' | 'irr' | 'payback';

interface MetricConfig {
  key: Metric;
  label: string;
  higherIsBetter: boolean;
  getValue: (c: MapCell, lifetime: number) => number;
  fmtCell: (v: number, lifetime: number) => string;
  fmtTip: (v: number | null, lifetime: number) => string;
  nullProxy: (lifetime: number) => number;
}

const NULL_IRR_PROXY = -1.0; // 미수렴 → −100%로 취급 (최악)
const NULL_PAYBACK_EXTRA = 10; // 미회수 → lifetime + 10년으로 취급

const METRICS: MetricConfig[] = [
  {
    key: 'npv',
    label: 'NPV',
    higherIsBetter: true,
    getValue: (c) => c.npv ?? -Infinity,
    fmtCell: (v) => `${(v / 1e8).toFixed(1)}억`,
    fmtTip: (v) => (v === null ? '계산불가' : `${(v / 1e8).toFixed(2)}억원`),
    nullProxy: () => -1e12,
  },
  {
    key: 'irr',
    label: 'IRR',
    higherIsBetter: true,
    getValue: (c) => c.irr ?? NULL_IRR_PROXY,
    fmtCell: (v) => (v <= NULL_IRR_PROXY ? '불가' : `${(v * 100).toFixed(1)}%`),
    fmtTip: (v) => (v === null ? '미수렴' : `${(v * 100).toFixed(2)}%`),
    nullProxy: () => NULL_IRR_PROXY,
  },
  {
    key: 'payback',
    label: '회수기간',
    higherIsBetter: false,
    getValue: (c, lifetime) => c.payback ?? lifetime + NULL_PAYBACK_EXTRA,
    fmtCell: (v, lifetime) => (v >= lifetime + NULL_PAYBACK_EXTRA ? '미회수' : `${v.toFixed(1)}년`),
    fmtTip: (v, lifetime) =>
      v === null ? '미회수' : v >= lifetime + NULL_PAYBACK_EXTRA ? '미회수' : `${v.toFixed(2)}년`,
    nullProxy: (lifetime) => lifetime + NULL_PAYBACK_EXTRA,
  },
];

// ─────────────────────────────────────────────────────────────
// 색상 계산
// ─────────────────────────────────────────────────────────────

/** 전체 셀 값의 min/max를 구해 0..1로 정규화 후 발산형 색상 반환. */
function cellColor(rawValue: number, min: number, max: number, higherIsBetter: boolean): string {
  if (min === max) return '#e5e7eb';

  // t=0(최악)→빨강, t=1(최선)→초록
  const normalized = (rawValue - min) / (max - min);
  const t = higherIsBetter ? normalized : 1 - normalized;

  if (t >= 0.5) {
    const s = (t - 0.5) * 2; // 0..1
    // white → green (#22c55e = 34,197,94)
    const r = Math.round(255 - (255 - 34) * s);
    const g = Math.round(255 - (255 - 197) * s);
    const b = Math.round(255 - (255 - 94) * s);
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (0.5 - t) * 2; // 0..1
    // white → red (#ef4444 = 239,68,68)
    const r = Math.round(255 - (255 - 239) * s);
    const g = Math.round(255 - (255 - 68) * s);
    const b = Math.round(255 - (255 - 68) * s);
    return `rgb(${r},${g},${b})`;
  }
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

interface Props {
  input: ProfitabilityMapInput;
}

export function ProfitabilityMap({ input }: Props) {
  const [metric, setMetric] = useState<Metric>('npv');
  const [hoveredCell, setHoveredCell] = useState<MapCell | null>(null);

  const result = useMemo(() => calcProfitabilityMap(input), [input]);
  const { cells, capexFactors, elecFactors, baseCapex, baseElecRev, lifetime } = result;

  const mc = METRICS.find((m) => m.key === metric)!;

  // 전체 셀의 min/max (색상 스케일 계산용)
  const allValues = useMemo(() => {
    return cells.flat().map((c) => mc.getValue(c, lifetime));
  }, [cells, mc, lifetime]);

  const vMin = Math.min(...allValues);
  const vMax = Math.max(...allValues);

  // NPV=0 경계 선분 (NPV 지표일 때만)
  const contourSegments = useMemo(() => {
    if (metric !== 'npv') return [];
    const segs: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const rows = cells.length;
    const cols = cells[0]?.length ?? 0;
    // 수직 경계 (좌우 인접 셀 부호 변화)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const n1 = cells[r][c].npv;
        const n2 = cells[r][c + 1].npv;
        if (n1 === null || n2 === null) continue;
        if (n1 >= 0 !== n2 >= 0) {
          const x = (c + 1) * CELL_W;
          segs.push({ x1: x, y1: r * CELL_H, x2: x, y2: (r + 1) * CELL_H });
        }
      }
    }
    // 수평 경계 (상하 인접 셀 부호 변화)
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        const n1 = cells[r][c].npv;
        const n2 = cells[r + 1][c].npv;
        if (n1 === null || n2 === null) continue;
        if (n1 >= 0 !== n2 >= 0) {
          const y = (r + 1) * CELL_H;
          segs.push({ x1: c * CELL_W, y1: y, x2: (c + 1) * CELL_W, y2: y });
        }
      }
    }
    return segs;
  }, [cells, metric]);

  // 기준 셀 (capexFactor=1.0, elecFactor=1.0)
  // elecFactors는 내림차순이므로 기준 행 = elecFactors.length - 1 - BASE_FACTOR_IDX
  const baseRowIdx = elecFactors.length - 1 - BASE_FACTOR_IDX;
  const baseColIdx = BASE_FACTOR_IDX;

  const baseCell = cells[baseRowIdx]?.[baseColIdx];
  const displayCell = hoveredCell ?? baseCell ?? null;

  // X축 레이블 (억원)
  const xLabels = capexFactors.map((f) => {
    const val = (baseCapex * f) / 1e8;
    return val >= 10 ? `${val.toFixed(0)}억` : `${val.toFixed(1)}억`;
  });

  // Y축 레이블 (발전수익 배율 %)
  const yLabels = elecFactors.map((f) => `${Math.round(f * 100)}%`);

  const gridWidth = capexFactors.length * CELL_W;
  const gridHeight = elecFactors.length * CELL_H;
  const totalWidth = Y_LABEL_W + gridWidth;

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

      {/* 히트맵 */}
      <div className="overflow-x-auto">
        <div style={{ width: totalWidth }}>
          {/* 그리드 영역 (Y레이블 + 셀) */}
          <div style={{ display: 'flex' }}>
            {/* Y축 레이블 */}
            <div style={{ width: Y_LABEL_W, flexShrink: 0 }} className="flex flex-col">
              {/* Y축 타이틀 (Y레이블 컬럼 맨 위) */}
              <div
                style={{ height: CELL_H, fontSize: 9 }}
                className="flex items-center justify-end pr-2 text-zinc-500"
              >
                발전수익
              </div>
              {yLabels.slice(1).map((lbl, i) => (
                <div
                  key={i}
                  style={{ height: CELL_H, fontSize: 10 }}
                  className="flex items-center justify-end pr-2 text-zinc-600"
                >
                  {lbl}
                </div>
              ))}
            </div>

            {/* 셀 그리드 */}
            <div style={{ width: gridWidth }}>
              {/* 셀 행 + NPV=0 경계선 SVG 오버레이 */}
              <div style={{ position: 'relative', width: gridWidth, height: gridHeight }}>
                {cells.map((row, rowIdx) => (
                  <div key={rowIdx} style={{ display: 'flex', height: CELL_H }}>
                    {row.map((cell, colIdx) => {
                      const v = mc.getValue(cell, lifetime);
                      const bg = cellColor(v, vMin, vMax, mc.higherIsBetter);
                      const isBase = rowIdx === baseRowIdx && colIdx === baseColIdx;
                      const isHovered =
                        hoveredCell?.capexFactor === cell.capexFactor &&
                        hoveredCell?.elecFactor === cell.elecFactor;

                      return (
                        <div
                          key={colIdx}
                          style={{
                            width: CELL_W,
                            height: CELL_H,
                            background: bg,
                            border: isBase
                              ? '2px solid #18181b'
                              : isHovered
                                ? '1.5px solid #3f3f46'
                                : '0.5px solid rgba(0,0,0,0.08)',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: 9,
                            fontWeight: isBase ? 700 : 400,
                            color: 'rgba(0,0,0,0.65)',
                            transition: 'filter 0.1s',
                          }}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {mc.fmtCell(v, lifetime)}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {/* NPV=0 경계선 오버레이 */}
                {contourSegments.length > 0 && (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      pointerEvents: 'none',
                      zIndex: 1,
                    }}
                    width={gridWidth}
                    height={gridHeight}
                  >
                    {contourSegments.map((seg, i) => (
                      <line
                        key={i}
                        x1={seg.x1}
                        y1={seg.y1}
                        x2={seg.x2}
                        y2={seg.y2}
                        stroke="#1e293b"
                        strokeWidth={2.5}
                        strokeLinecap="square"
                      />
                    ))}
                  </svg>
                )}
              </div>

              {/* X축 레이블 */}
              <div style={{ display: 'flex', height: X_LABEL_H }}>
                {xLabels.map((lbl, i) => (
                  <div
                    key={i}
                    style={{ width: CELL_W, fontSize: 9 }}
                    className="flex flex-col items-center justify-start pt-1 text-zinc-600"
                  >
                    <span>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* X축 타이틀 */}
          <div
            style={{ marginLeft: Y_LABEL_W, fontSize: 10 }}
            className="text-center text-zinc-500 -mt-2"
          >
            CAPEX (설치비용)
          </div>
        </div>
      </div>

      {/* 색상 범례 */}
      <div className="flex items-center gap-2" style={{ marginLeft: Y_LABEL_W }}>
        <span className="text-xs text-zinc-500">{mc.higherIsBetter ? '낮음' : '좋음'}</span>
        <div
          style={{
            width: 160,
            height: LEGEND_H / 2,
            background: mc.higherIsBetter
              ? 'linear-gradient(to right, #ef4444, #fff, #22c55e)'
              : 'linear-gradient(to right, #22c55e, #fff, #ef4444)',
            borderRadius: 2,
            border: '1px solid rgba(0,0,0,0.1)',
          }}
        />
        <span className="text-xs text-zinc-500">{mc.higherIsBetter ? '높음' : '나쁨'}</span>
        <span className="text-xs text-zinc-400 ml-2">■ 기준값 셀</span>
        {metric === 'npv' && (
          <span className="text-xs text-zinc-600 ml-2 flex items-center gap-1">
            <svg width="16" height="8" style={{ display: 'inline' }}>
              <line x1="0" y1="4" x2="16" y2="4" stroke="#1e293b" strokeWidth="2.5" />
            </svg>
            NPV=0 경계
          </span>
        )}
      </div>

      {/* 선택/기준 셀 정보 패널 */}
      {displayCell && (
        <div
          className="rounded border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-700"
          style={{ marginLeft: Y_LABEL_W }}
        >
          <span className="font-semibold text-zinc-800">{hoveredCell ? '선택 셀' : '기준 셀'}</span>
          &nbsp;|&nbsp; CAPEX&nbsp;
          <span className="font-medium text-zinc-900">
            {(displayCell.capexAbs / 1e8).toFixed(1)}억원
          </span>
          &nbsp;({Math.round(displayCell.capexFactor * 100)}%)&nbsp;&nbsp; 발전수익&nbsp;
          <span className="font-medium text-zinc-900">
            {(displayCell.elecRevAbs / 1e8).toFixed(2)}억원/년
          </span>
          &nbsp;({Math.round(displayCell.elecFactor * 100)}%)
          <span className="mx-3 text-zinc-300">|</span>
          NPV&nbsp;
          <span className="font-medium text-zinc-900">{mc.fmtTip(displayCell.npv, lifetime)}</span>
          &nbsp;&nbsp;IRR&nbsp;
          <span className="font-medium text-zinc-900">
            {displayCell.irr === null ? '미수렴' : `${(displayCell.irr * 100).toFixed(2)}%`}
          </span>
          &nbsp;&nbsp;회수기간&nbsp;
          <span className="font-medium text-zinc-900">
            {displayCell.payback === null
              ? '미회수'
              : displayCell.payback >= lifetime + NULL_PAYBACK_EXTRA
                ? '미회수'
                : `${displayCell.payback.toFixed(1)}년`}
          </span>
        </div>
      )}
    </div>
  );
}
