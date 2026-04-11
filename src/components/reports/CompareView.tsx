'use client';

/**
 * Phase 8-2 — 리포트 비교 (최대 4개).
 * Phase 10-C 강화 — 승자 요약 카드 + SVG 수평 막대 차트 추가.
 *
 * /reports/compare?ids=a,b,c → 각 리포트 로드 후 섹션별 지표를 나란히 표시.
 * 각 행에서 최우수값(초록)을 강조한다.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadReport } from '@/lib/actions/reports';
import type { ReportSnapshot } from '@/lib/schemas/report';
import { fmtKW, fmtWon, fmtWonPerKWh, fmtPct, fmtYears } from '@/lib/format';

interface Loaded {
  id: string;
  title: string | null;
  snapshot: ReportSnapshot;
}

export function CompareView({ ids }: { ids: string[] }) {
  const [items, setItems] = useState<Loaded[]>([]);
  const [loading, setLoading] = useState(true);
  const [errs, setErrs] = useState<string[]>([]);

  useEffect(() => {
    if (ids.length === 0) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    (async () => {
      const results = await Promise.all(ids.map((id) => loadReport(id).then((r) => ({ id, r }))));
      const ok: Loaded[] = [];
      const errors: string[] = [];
      for (const { id, r } of results) {
        if (r.ok) ok.push({ id, title: r.data.title, snapshot: r.data.snapshot });
        else errors.push(`${id.slice(0, 8)}: ${r.error}`);
      }
      setItems(ok);
      setErrs(errors);
      setLoading(false);
    })();
  }, [ids]);

  if (loading) return <div className="text-zinc-500">불러오는 중...</div>;

  if (ids.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-600">비교할 리포트를 선택하지 않았습니다.</p>
        <Link href="/reports" className="text-blue-600 underline">
          ← 리포트 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 print:hidden">
        <Link href="/reports" className="text-sm text-blue-600 underline">
          ← 리포트 목록
        </Link>
        <span className="flex-1" />
        <span className="text-xs text-zinc-500">{items.length}건 비교</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 border border-zinc-300 rounded text-xs bg-white hover:bg-zinc-50"
          >
            인쇄 / PDF
          </button>
        )}
      </div>

      {errs.length > 0 && <div className="text-sm text-red-600">로드 실패: {errs.join(', ')}</div>}

      {items.length > 0 && (
        <>
          {items.length >= 2 && <WinnerSummary items={items} />}
          {items.length >= 2 && <CompareCharts items={items} />}
          <div>
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
              상세 비교
            </div>
            <CompareTable items={items} />
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 비교 테이블
// ─────────────────────────────────────────────────────────────────

interface ExtractedData {
  capacity: number | null;
  capex: number | null;
  lcoe: number | null;
  payback: number | null;
  annualElecRev: number | null;
  annualHeatRev: number | null;
  annualGasCost: number | null;
  annualFinalRev: number | null;
  annualMaint: number | null;
  npv: Record<number, number | null>;
  irr: Record<number, number | null>;
  roi20: number | null;
  lifetime: number;
  discountRate: number;
  elecEsc: number;
  gasEsc: number;
  maintEsc: number;
  maintMode: string;
}

function extractData(it: Loaded): ExtractedData {
  const e = it.snapshot.results.economics;
  const rev = it.snapshot.results.revenue.합계;
  const s = it.snapshot.settings;

  const summaryAt = (yr: number) => e.summary.데이터.find((r) => r.기간_년 === yr);

  return {
    capacity: it.snapshot.inputs.fuelCell.총설치용량_kW,
    capex: e.capex,
    lcoe: e.lcoe_원per_kWh,
    payback: it.snapshot.results.paybackYears,
    annualElecRev: rev.발전_월간총수익_원,
    annualHeatRev: rev.열생산_월간총수익_원,
    annualGasCost: rev.도시가스사용요금_원,
    annualFinalRev: rev.에너지생산_최종수익_원,
    annualMaint: e.baseAnnualMaintenance,
    npv: {
      5: summaryAt(5)?.NPV_원 ?? null,
      10: summaryAt(10)?.NPV_원 ?? null,
      15: summaryAt(15)?.NPV_원 ?? null,
      20: summaryAt(20)?.NPV_원 ?? null,
    },
    irr: {
      5: summaryAt(5)?.IRR ?? null,
      10: summaryAt(10)?.IRR ?? null,
      15: summaryAt(15)?.IRR ?? null,
      20: summaryAt(20)?.IRR ?? null,
    },
    roi20: summaryAt(20)?.ROI_초기투자 ?? null,
    lifetime: s.lifetime,
    discountRate: s.discountRate,
    elecEsc: s.electricityEscalation,
    gasEsc: s.gasEscalation,
    maintEsc: s.maintenanceEscalation,
    maintMode: s.maintenanceMode === 'fixedCost' ? '라이브러리 단가' : '비율',
  };
}

type DataRow =
  | { type: 'section'; label: string }
  | {
      type: 'data';
      label: string;
      values: (number | null)[];
      fmt: (v: number | null) => string;
      higherIsBetter?: boolean;
    };

function bestIndex(values: (number | null)[], higherIsBetter: boolean): number | null {
  const numeric = values
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v != null && Number.isFinite(v as number));
  if (numeric.length < 2) return null;
  return numeric.reduce((best, cur) => {
    const isBetter = higherIsBetter ? cur.v! > best.v! : cur.v! < best.v!;
    return isBetter ? cur : best;
  }).i;
}

function worstIndex(values: (number | null)[], higherIsBetter: boolean): number | null {
  return bestIndex(values, !higherIsBetter);
}

// ─────────────────────────────────────────────────────────────────
// 승자 요약 카드 (2건 이상 비교 시 표시)
// ─────────────────────────────────────────────────────────────────

interface WinnerCardInfo {
  label: string;
  winnerTitle: string | null;
  valueStr: string;
  rawValue: number | null;
}

function WinnerSummary({ items }: { items: Loaded[] }) {
  const data = items.map(extractData);

  function winner(
    values: (number | null)[],
    higherIsBetter: boolean,
    fmt: (v: number | null) => string,
  ): WinnerCardInfo | null {
    const idx = bestIndex(values, higherIsBetter);
    if (idx == null) return null;
    return {
      label: '',
      winnerTitle: items[idx].title,
      valueStr: fmt(values[idx]),
      rawValue: values[idx],
    };
  }

  const cards: WinnerCardInfo[] = (
    [
      (() => {
        const w = winner(
          data.map((d) => d.npv[20]),
          true,
          fmtWon,
        );
        return w ? { ...w, label: '20년 NPV 최고' } : null;
      })(),
      (() => {
        const w = winner(
          data.map((d) => d.capex),
          false,
          fmtWon,
        );
        return w ? { ...w, label: 'CAPEX 최저' } : null;
      })(),
      (() => {
        const w = winner(
          data.map((d) => d.payback),
          false,
          (v) => (v == null ? '회수 불가' : fmtYears(v)),
        );
        return w ? { ...w, label: '회수기간 최단' } : null;
      })(),
      (() => {
        const w = winner(
          data.map((d) => d.irr[20]),
          true,
          fmtPct,
        );
        return w ? { ...w, label: '20년 IRR 최고' } : null;
      })(),
    ] as (WinnerCardInfo | null)[]
  ).filter((c): c is WinnerCardInfo => c != null);

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="border border-zinc-200 rounded-lg px-3 py-2.5 bg-white">
          <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
            {card.label}
          </div>
          <div
            className="text-sm font-semibold text-zinc-800 truncate"
            title={card.winnerTitle ?? undefined}
          >
            {card.winnerTitle ?? '(제목 없음)'}
          </div>
          <div
            className={`text-xs font-medium mt-0.5 ${
              card.rawValue != null && card.rawValue < 0 ? 'text-red-600' : 'text-green-700'
            }`}
          >
            {card.valueStr}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SVG 수평 막대 비교 차트
// ─────────────────────────────────────────────────────────────────

function CompareBarChart({
  items,
  title,
  values,
  fmt,
  higherIsBetter,
}: {
  items: Loaded[];
  title: string;
  values: (number | null)[];
  fmt: (v: number | null) => string;
  higherIsBetter: boolean;
}) {
  const numeric = values.map((v) => (v != null && Number.isFinite(v) ? v : null));
  const valids = numeric.filter((v): v is number => v != null);
  if (valids.length === 0) return null;

  const maxAbs = Math.max(...valids.map(Math.abs));
  const bestIdx = bestIndex(values, higherIsBetter);

  const barPct = (v: number | null) => {
    if (v == null || maxAbs === 0) return 0;
    return (Math.abs(v) / maxAbs) * 100;
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-3">
        {title}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => {
          const val = numeric[i];
          const pct = barPct(val);
          const isBest = bestIdx === i;
          const isNeg = val != null && val < 0;
          return (
            <div key={item.id} className="space-y-0.5">
              <div className="text-xs text-zinc-500 truncate" title={item.title ?? undefined}>
                {item.title ?? '(제목 없음)'}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="flex-1 h-4 bg-zinc-100 rounded overflow-hidden">
                  {val != null && (
                    <div
                      className={`h-full rounded ${
                        isNeg ? 'bg-red-400' : isBest ? 'bg-green-500' : 'bg-blue-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
                <div
                  className={`w-28 flex-shrink-0 text-right font-medium ${
                    isBest ? 'text-green-700' : isNeg ? 'text-red-600' : 'text-zinc-700'
                  }`}
                >
                  {val == null ? '-' : fmt(val)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompareCharts({ items }: { items: Loaded[] }) {
  const data = items.map(extractData);

  const charts = [
    {
      title: '20년 NPV',
      values: data.map((d) => d.npv[20]),
      fmt: fmtWon,
      higherIsBetter: true,
    },
    {
      title: 'CAPEX',
      values: data.map((d) => d.capex),
      fmt: fmtWon,
      higherIsBetter: false,
    },
    {
      title: '회수기간',
      values: data.map((d) => d.payback),
      fmt: (v: number | null) => (v == null ? '회수 불가' : fmtYears(v)),
      higherIsBetter: false,
    },
    {
      title: 'LCOE (전기)',
      values: data.map((d) => d.lcoe),
      fmt: fmtWonPerKWh,
      higherIsBetter: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2">
      {charts.map((c) => (
        <CompareBarChart key={c.title} items={items} {...c} />
      ))}
    </div>
  );
}

function buildRows(items: Loaded[]): DataRow[] {
  const data = items.map(extractData);
  const v = <K extends keyof ExtractedData>(key: K) => data.map((d) => d[key] as number | null);
  const npvAt = (yr: number) => data.map((d) => d.npv[yr] ?? null);
  const irrAt = (yr: number) => data.map((d) => d.irr[yr] ?? null);

  return [
    // ── 설비 정보
    { type: 'section', label: '설비 정보' },
    { type: 'data', label: '총 설치용량', values: v('capacity'), fmt: fmtKW },
    { type: 'data', label: 'CAPEX', values: v('capex'), fmt: fmtWon, higherIsBetter: false },
    {
      type: 'data',
      label: 'LCOE (전기)',
      values: v('lcoe'),
      fmt: fmtWonPerKWh,
      higherIsBetter: false,
    },

    // ── 에너지 수익 (연간 기준값)
    { type: 'section', label: '에너지 수익 (연간, 1년차)' },
    {
      type: 'data',
      label: '발전 수익',
      values: v('annualElecRev'),
      fmt: fmtWon,
      higherIsBetter: true,
    },
    {
      type: 'data',
      label: '열 수익',
      values: v('annualHeatRev'),
      fmt: fmtWon,
      higherIsBetter: true,
    },
    {
      type: 'data',
      label: '가스 요금',
      values: v('annualGasCost'),
      fmt: fmtWon,
      higherIsBetter: false,
    },
    {
      type: 'data',
      label: '최종 수익',
      values: v('annualFinalRev'),
      fmt: fmtWon,
      higherIsBetter: true,
    },
    {
      type: 'data',
      label: '기준 유지보수비',
      values: v('annualMaint'),
      fmt: fmtWon,
      higherIsBetter: false,
    },

    // ── 경제성
    { type: 'section', label: '경제성' },
    {
      type: 'data',
      label: '회수기간',
      values: v('payback'),
      fmt: (v) => (v == null ? '회수 불가' : fmtYears(v)),
      higherIsBetter: false,
    },
    { type: 'data', label: 'NPV (5년)', values: npvAt(5), fmt: fmtWon, higherIsBetter: true },
    { type: 'data', label: 'NPV (10년)', values: npvAt(10), fmt: fmtWon, higherIsBetter: true },
    { type: 'data', label: 'NPV (15년)', values: npvAt(15), fmt: fmtWon, higherIsBetter: true },
    { type: 'data', label: 'NPV (20년)', values: npvAt(20), fmt: fmtWon, higherIsBetter: true },
    { type: 'data', label: 'IRR (5년)', values: irrAt(5), fmt: fmtPct, higherIsBetter: true },
    { type: 'data', label: 'IRR (10년)', values: irrAt(10), fmt: fmtPct, higherIsBetter: true },
    { type: 'data', label: 'IRR (15년)', values: irrAt(15), fmt: fmtPct, higherIsBetter: true },
    { type: 'data', label: 'IRR (20년)', values: irrAt(20), fmt: fmtPct, higherIsBetter: true },
    { type: 'data', label: 'ROI (20년)', values: v('roi20'), fmt: fmtPct, higherIsBetter: true },

    // ── 분석 설정
    { type: 'section', label: '분석 설정' },
    {
      type: 'data',
      label: '분석기간',
      values: data.map((d) => d.lifetime) as (number | null)[],
      fmt: (v) => (v == null ? '-' : `${v} 년`),
    },
    {
      type: 'data',
      label: '할인율',
      values: data.map((d) => d.discountRate) as (number | null)[],
      fmt: fmtPct,
    },
    {
      type: 'data',
      label: '전기 상승률',
      values: data.map((d) => d.elecEsc) as (number | null)[],
      fmt: fmtPct,
    },
    {
      type: 'data',
      label: '가스 상승률',
      values: data.map((d) => d.gasEsc) as (number | null)[],
      fmt: fmtPct,
    },
    {
      type: 'data',
      label: '유지비 상승률',
      values: data.map((d) => d.maintEsc) as (number | null)[],
      fmt: fmtPct,
    },
  ];
}

function CompareTable({ items }: { items: Loaded[] }) {
  const rows = buildRows(items);
  const colCount = items.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-900 text-white">
            <th className="px-3 py-2 text-left font-medium w-40">항목</th>
            {items.map((it) => (
              <th key={it.id} className="px-3 py-2 text-left font-medium">
                <Link href={`/report?id=${it.id}`} className="hover:underline print:no-underline">
                  {it.title ?? '(제목 없음)'}
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.type === 'section') {
              return (
                <tr key={`sec-${ri}`} className="bg-zinc-100">
                  <td
                    colSpan={colCount + 1}
                    className="px-3 py-1.5 text-xs font-semibold text-zinc-600 uppercase tracking-wide"
                  >
                    {row.label}
                  </td>
                </tr>
              );
            }

            const { label, values, fmt, higherIsBetter } = row;
            const best = higherIsBetter != null ? bestIndex(values, higherIsBetter) : null;
            const worst = higherIsBetter != null ? worstIndex(values, higherIsBetter) : null;

            return (
              <tr
                key={`row-${ri}`}
                className="border-b border-zinc-200 odd:bg-white even:bg-zinc-50"
              >
                <td className="px-3 py-2 text-zinc-600 font-medium whitespace-nowrap">{label}</td>
                {values.map((val, ci) => {
                  const isBest = best === ci;
                  const isWorst = worst === ci;
                  const cellClass = isBest
                    ? 'text-green-700 font-semibold'
                    : isWorst
                      ? 'text-red-600'
                      : 'text-zinc-800';
                  return (
                    <td key={ci} className={`px-3 py-2 text-right ${cellClass}`}>
                      {fmt(val)}
                      {isBest && colCount > 1 && (
                        <span className="ml-1 text-[10px] text-green-600">▲</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-xs text-zinc-400 print:hidden">
        <span className="text-green-700 font-medium">초록 ▲</span> = 해당 행 최우수값,{' '}
        <span className="text-red-600">빨강</span> = 최저값. 2건 이상 비교 시 강조 표시됩니다.
      </p>
    </div>
  );
}
