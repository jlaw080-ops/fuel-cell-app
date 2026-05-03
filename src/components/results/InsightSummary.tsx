'use client';

import { useMemo } from 'react';
import {
  calcProfitabilityMap,
  BASE_FACTOR_IDX,
  MAP_FACTORS,
  type ProfitabilityMapInput,
  type MapCell,
} from '@/lib/calc/profitabilityMap';

interface Props {
  npv: number | null;
  irr: number | null;
  payback: number | null;
  lifetime: number;
  discountRate: number;
  input: ProfitabilityMapInput;
}

type Verdict = 'good' | 'marginal' | 'poor';

function findCapexBreakeven(
  cells: MapCell[][],
  baseRowIdx: number,
  capexFactors: number[],
): number | null {
  const baseColIdx = BASE_FACTOR_IDX;
  const baseNpv = cells[baseRowIdx][baseColIdx].npv;
  if (baseNpv === null) return null;

  if (baseNpv >= 0) {
    for (let col = baseColIdx + 1; col < capexFactors.length; col++) {
      const n = cells[baseRowIdx][col].npv;
      if (n === null) continue;
      if (n < 0) {
        const prev = cells[baseRowIdx][col - 1].npv!;
        const t = prev / (prev - n);
        return capexFactors[col - 1] + t * (capexFactors[col] - capexFactors[col - 1]);
      }
    }
    return null;
  } else {
    for (let col = baseColIdx - 1; col >= 0; col--) {
      const n = cells[baseRowIdx][col].npv;
      if (n === null) continue;
      if (n > 0) {
        const prev = cells[baseRowIdx][col + 1].npv!;
        const t = -prev / (n - prev);
        return capexFactors[col + 1] + t * (capexFactors[col] - capexFactors[col + 1]);
      }
    }
    return null;
  }
}

function findElecBreakeven(
  cells: MapCell[][],
  elecFactors: number[],
  baseColIdx: number,
): number | null {
  const baseRowIdx = elecFactors.length - 1 - BASE_FACTOR_IDX;
  const baseNpv = cells[baseRowIdx][baseColIdx].npv;
  if (baseNpv === null) return null;

  if (baseNpv >= 0) {
    // scan downward (higher rowIdx = lower elecFactor)
    for (let row = baseRowIdx + 1; row < elecFactors.length; row++) {
      const n = cells[row][baseColIdx].npv;
      if (n === null) continue;
      if (n < 0) {
        const prev = cells[row - 1][baseColIdx].npv!;
        const t = prev / (prev - n);
        return elecFactors[row - 1] + t * (elecFactors[row] - elecFactors[row - 1]);
      }
    }
    return null;
  } else {
    // scan upward (lower rowIdx = higher elecFactor)
    for (let row = baseRowIdx - 1; row >= 0; row--) {
      const n = cells[row][baseColIdx].npv;
      if (n === null) continue;
      if (n > 0) {
        const prev = cells[row + 1][baseColIdx].npv!;
        const t = -prev / (n - prev);
        return elecFactors[row + 1] + t * (elecFactors[row] - elecFactors[row + 1]);
      }
    }
    return null;
  }
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'neutral';
}) {
  const colorMap = {
    green: 'text-green-700',
    red: 'text-red-600',
    neutral: 'text-zinc-800',
  };
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 rounded border border-zinc-200 bg-white min-w-[100px]">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-base font-bold ${colorMap[accent ?? 'neutral']}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-400">{sub}</span>}
    </div>
  );
}

function SafetyBar({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) {
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{label}</span>
          <span>데이터 없음</span>
        </div>
        <div className="h-2 rounded bg-zinc-100" />
      </div>
    );
  }

  // clamp to [-50, 50] for display
  const clamped = Math.max(-50, Math.min(50, pct));
  const positive = pct >= 0;
  const barPct = Math.abs(clamped) * 2; // 0..100

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-zinc-600">{label}</span>
        <span className={positive ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
          {positive ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`}
          <span className="text-zinc-400 font-normal ml-1">{positive ? '여유' : '부족'}</span>
        </span>
      </div>
      <div className="h-2 rounded bg-zinc-100 overflow-hidden">
        <div
          className={`h-full rounded transition-all ${positive ? 'bg-green-400' : 'bg-red-400'}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

export function InsightSummary({ npv, irr, payback, lifetime, discountRate, input }: Props) {
  const { cells, capexFactors, elecFactors } = useMemo(() => calcProfitabilityMap(input), [input]);

  const baseRowIdx = elecFactors.length - 1 - BASE_FACTOR_IDX;
  const baseColIdx = BASE_FACTOR_IDX;

  const capexBreakeven = useMemo(
    () => findCapexBreakeven(cells, baseRowIdx, capexFactors),
    [cells, baseRowIdx, capexFactors],
  );

  const elecBreakeven = useMemo(
    () => findElecBreakeven(cells, elecFactors, baseColIdx),
    [cells, elecFactors, baseColIdx],
  );

  // positive = can raise CAPEX by this %, negative = CAPEX must drop by this %
  const capexMarginPct = capexBreakeven !== null ? (capexBreakeven - 1.0) * 100 : null;
  // positive = 발전수익 can drop by this %, negative = must rise by this %
  const elecMarginPct = elecBreakeven !== null ? (1.0 - elecBreakeven) * 100 : null;

  const verdict: Verdict = useMemo(() => {
    if (npv === null) return 'marginal';
    if (npv < 0) return 'poor';
    const irrOk = irr === null || irr >= discountRate;
    const paybackOk = payback === null || payback <= lifetime;
    if (irrOk && paybackOk) return 'good';
    return 'marginal';
  }, [npv, irr, payback, lifetime, discountRate]);

  const verdictConfig = {
    good: {
      label: '투자 적합',
      bg: 'bg-green-50 border-green-200',
      badge: 'bg-green-100 text-green-800',
      dot: 'bg-green-500',
    },
    marginal: {
      label: '경계 구간',
      bg: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-100 text-amber-800',
      dot: 'bg-amber-400',
    },
    poor: {
      label: '투자 부적합',
      bg: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-800',
      dot: 'bg-red-500',
    },
  }[verdict];

  const npvAccent: 'green' | 'red' | 'neutral' =
    npv === null ? 'neutral' : npv >= 0 ? 'green' : 'red';
  const irrAccent: 'green' | 'red' | 'neutral' =
    irr === null ? 'neutral' : irr >= discountRate ? 'green' : 'red';
  const paybackAccent: 'green' | 'red' | 'neutral' =
    payback === null ? 'neutral' : payback <= lifetime ? 'green' : 'red';

  const npvStr = npv === null ? '계산불가' : `${(npv / 1e8).toFixed(1)}억원`;
  const irrStr = irr === null ? '미수렴' : `${(irr * 100).toFixed(1)}%`;
  const paybackStr = payback === null ? '미회수' : `${payback.toFixed(1)}년`;

  const bullets = buildBullets(
    verdict,
    npv,
    irr,
    payback,
    discountRate,
    lifetime,
    capexMarginPct,
    elecMarginPct,
  );

  return (
    <div className={`rounded-lg border p-5 space-y-4 ${verdictConfig.bg}`}>
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${verdictConfig.badge}`}
        >
          <span className={`w-2 h-2 rounded-full ${verdictConfig.dot}`} />
          {verdictConfig.label}
        </span>
        <span className="text-sm text-zinc-500">기준 시나리오 투자 진단</span>
      </div>

      {/* 핵심 지표 */}
      <div className="flex flex-wrap gap-2">
        <MetricCard
          label="NPV"
          value={npvStr}
          sub={`할인율 ${(discountRate * 100).toFixed(1)}%`}
          accent={npvAccent}
        />
        <MetricCard
          label="IRR"
          value={irrStr}
          sub={`기준 ${(discountRate * 100).toFixed(1)}%`}
          accent={irrAccent}
        />
        <MetricCard
          label="회수기간"
          value={paybackStr}
          sub={`내용연수 ${lifetime}년`}
          accent={paybackAccent}
        />
      </div>

      {/* 여유율 바 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-zinc-600">NPV=0 도달까지의 여유율</p>
        <SafetyBar pct={capexMarginPct} label="CAPEX 상승 여유" />
        <SafetyBar pct={elecMarginPct} label="발전수익 하락 여유" />
      </div>

      {/* 인사이트 불릿 */}
      {bullets.length > 0 && (
        <ul className="space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
              <span className="mt-1 text-zinc-400 shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildBullets(
  verdict: Verdict,
  npv: number | null,
  irr: number | null,
  payback: number | null,
  discountRate: number,
  lifetime: number,
  capexMargin: number | null,
  elecMargin: number | null,
): string[] {
  const bullets: string[] = [];

  if (verdict === 'good') {
    if (capexMargin !== null && capexMargin > 0) {
      bullets.push(
        `현재 NPV 기준, 설치비가 ${capexMargin.toFixed(0)}% 더 올라도 손익분기를 넘지 않습니다.`,
      );
    }
    if (elecMargin !== null && elecMargin > 0) {
      bullets.push(
        `발전수익이 ${elecMargin.toFixed(0)}% 줄어도 NPV가 양(+)을 유지합니다. 전기요금 변동 리스크에 내성이 있습니다.`,
      );
    }
    if (irr !== null && irr >= discountRate) {
      bullets.push(
        `IRR(${(irr * 100).toFixed(1)}%)이 할인율(${(discountRate * 100).toFixed(1)}%)을 상회해 자본 조달 비용을 충분히 회수합니다.`,
      );
    }
  } else if (verdict === 'marginal') {
    if (npv !== null && npv >= 0 && payback !== null && payback > lifetime) {
      bullets.push(
        `NPV는 양(+)이지만 회수기간(${payback.toFixed(1)}년)이 내용연수(${lifetime}년)를 초과합니다. 수익 회수가 지연될 수 있습니다.`,
      );
    }
    if (npv !== null && npv >= 0 && irr !== null && irr < discountRate) {
      bullets.push(
        `NPV는 양(+)이지만 IRR(${(irr * 100).toFixed(1)}%)이 할인율(${(discountRate * 100).toFixed(1)}%) 미만입니다. 타 투자 대비 수익률이 낮습니다.`,
      );
    }
    if (capexMargin !== null) {
      if (capexMargin > 0) {
        bullets.push(
          `설치비 ${capexMargin.toFixed(0)}% 이내 상승까지만 NPV가 양입니다. 견적 변동에 주의하세요.`,
        );
      } else {
        bullets.push(
          `현재 설치비를 ${Math.abs(capexMargin).toFixed(0)}% 낮춰야 NPV가 0을 넘습니다.`,
        );
      }
    }
  } else {
    // poor
    if (capexMargin !== null && capexMargin < 0) {
      bullets.push(
        `NPV를 양(+)으로 만들려면 설치비를 ${Math.abs(capexMargin).toFixed(0)}% 줄여야 합니다.`,
      );
    }
    if (elecMargin !== null && elecMargin < 0) {
      bullets.push(
        `발전수익이 ${Math.abs(elecMargin).toFixed(0)}% 더 높아져야 손익분기에 도달합니다.`,
      );
    }
    if (capexMargin === null && elecMargin === null) {
      bullets.push(
        '현재 그리드 범위(±50%) 내에서 NPV 손익분기점을 찾을 수 없습니다. 근본적인 수익 구조 재검토가 필요합니다.',
      );
    }
  }

  // MAP_FACTORS coverage note
  const capexOutOfGrid = capexMargin === null && verdict !== 'poor';
  if (capexOutOfGrid) {
    bullets.push(
      '설치비를 50% 이상 올려도 NPV가 양(+)을 유지합니다. 매우 안정적인 수익 구조입니다.',
    );
  }

  return bullets.slice(0, 3);
}
