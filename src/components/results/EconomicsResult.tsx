'use client';

/**
 * Phase 4d — 경제성 결과 (카드 + 연도별 21행 표 + Summary 표).
 */
import type { EconomicsResult as EconResult } from '@/lib/calc/economics/economics';
import { fmtWon, fmtWonPerKWh, fmtYears, fmtPct } from '@/lib/format';

interface Props {
  result: EconResult;
  payback: number | null;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 rounded p-4 bg-white">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

export function EconomicsResult({ result, payback }: Props) {
  return (
    <div className="space-y-6">
      {/* 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="초기투자비 (CAPEX)" value={fmtWon(result.capex)} />
        <Card label="기준 연간 유지보수비" value={fmtWon(result.baseAnnualMaintenance)} />
        <Card label="LCOE (전기)" value={fmtWonPerKWh(result.lcoe_원per_kWh)} />
        <Card label="회수기간 (단순)" value={payback == null ? '회수 불가' : fmtYears(payback)} />
      </div>

      {/* 연도별 표 */}
      <div>
        <h4 className="text-sm font-semibold mb-2">
          연도별 현금흐름 ({result.annual.데이터.length - 1}년)
        </h4>
        <div className="overflow-x-auto max-h-96 border border-zinc-200 rounded">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-zinc-50 sticky top-0">
              <tr className="border-b border-zinc-300">
                <th className="px-2 py-2 text-left">연도</th>
                <th className="px-2 py-2 text-right">총수익</th>
                <th className="px-2 py-2 text-right">유지보수비</th>
                <th className="px-2 py-2 text-right">순현금흐름</th>
                <th className="px-2 py-2 text-right">누적</th>
                <th className="px-2 py-2 text-right">할인</th>
              </tr>
            </thead>
            <tbody>
              {result.annual.데이터.map((r) => (
                <tr key={r.연도} className="border-b border-zinc-100">
                  <td className="px-2 py-1.5">{r.연도}년</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.총수익_원)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.유지보수비용_원)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.순현금흐름_원)}</td>
                  <td
                    className={
                      'px-2 py-1.5 text-right ' +
                      ((r.누적순현금흐름_원 ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')
                    }
                  >
                    {fmtWon(r.누적순현금흐름_원)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.할인순현금흐름_원)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div>
        <h4 className="text-sm font-semibold mb-2">기간별 요약</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-zinc-50">
              <tr className="border-b border-zinc-300">
                <th className="px-2 py-2 text-left">기간</th>
                <th className="px-2 py-2 text-right">누적 수익</th>
                <th className="px-2 py-2 text-right">누적 유지비</th>
                <th className="px-2 py-2 text-right">총비용</th>
                <th className="px-2 py-2 text-right">ROI (투자)</th>
                <th className="px-2 py-2 text-right">ROI (총비용)</th>
                <th className="px-2 py-2 text-right">NPV</th>
                <th className="px-2 py-2 text-right">IRR</th>
              </tr>
            </thead>
            <tbody>
              {result.summary.데이터.map((r) => (
                <tr key={r.기간_년} className="border-b border-zinc-100">
                  <td className="px-2 py-1.5">{r.기간_년}년</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.누적수익_원)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.누적유지보수비용_원)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtWon(r.총비용_원)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtPct(r.ROI_초기투자)}</td>
                  <td className="px-2 py-1.5 text-right">{fmtPct(r.ROI_총비용)}</td>
                  <td
                    className={
                      'px-2 py-1.5 text-right ' +
                      ((r.NPV_원 ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')
                    }
                  >
                    {fmtWon(r.NPV_원)}
                  </td>
                  <td className="px-2 py-1.5 text-right">{fmtPct(r.IRR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
