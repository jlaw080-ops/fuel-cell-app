'use client';

/**
 * Phase 4b — 수익 결과 표.
 */
import type { EnergyRevenueOutput } from '@/types/outputs';
import { fmtInt, fmtWon } from '@/lib/format';

interface Props {
  data: EnergyRevenueOutput;
}

export function RevenueTable({ data }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-zinc-50">
          <tr className="border-b border-zinc-300">
            <th className="px-2 py-2 text-left">월</th>
            <th className="px-2 py-2 text-right">일수</th>
            <th className="px-2 py-2 text-right">발전 수익</th>
            <th className="px-2 py-2 text-right">열 수익</th>
            <th className="px-2 py-2 text-right">가스 요금</th>
            <th className="px-2 py-2 text-right">최종 수익</th>
          </tr>
        </thead>
        <tbody>
          {data.데이터.map((r) => (
            <tr key={r.월} className="border-b border-zinc-100">
              <td className="px-2 py-1.5">{r.월}월</td>
              <td className="px-2 py-1.5 text-right">{fmtInt(r.일수)}</td>
              <td className="px-2 py-1.5 text-right">{fmtWon(r.발전_월간총수익_원)}</td>
              <td className="px-2 py-1.5 text-right">{fmtWon(r.열생산_월간총수익_원)}</td>
              <td className="px-2 py-1.5 text-right">{fmtWon(r.도시가스사용요금_원)}</td>
              <td className="px-2 py-1.5 text-right font-medium">
                {fmtWon(r.에너지생산_최종수익_원)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-zinc-50 font-semibold">
          <tr>
            <td className="px-2 py-2">합계</td>
            <td className="px-2 py-2 text-right">{fmtInt(data.합계.일수)}</td>
            <td className="px-2 py-2 text-right">{fmtWon(data.합계.발전_월간총수익_원)}</td>
            <td className="px-2 py-2 text-right">{fmtWon(data.합계.열생산_월간총수익_원)}</td>
            <td className="px-2 py-2 text-right">{fmtWon(data.합계.도시가스사용요금_원)}</td>
            <td className="px-2 py-2 text-right">{fmtWon(data.합계.에너지생산_최종수익_원)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
