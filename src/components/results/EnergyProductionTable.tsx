'use client';

/**
 * Phase 4b — 에너지 산출 결과 표.
 * 월별 12행 + 합계 row. 계산 무효(null) 시 부모가 렌더하지 않음.
 */
import type { EnergyProductionOutput } from '@/types/outputs';
import { fmtInt, fmtKW, fmtKWh } from '@/lib/format';

interface Props {
  data: EnergyProductionOutput;
}

export function EnergyProductionTable({ data }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-zinc-50">
          <tr className="border-b border-zinc-300">
            <th className="px-2 py-2 text-left">월</th>
            <th className="px-2 py-2 text-right">일수</th>
            <th className="px-2 py-2 text-right">계약용량</th>
            <th className="px-2 py-2 text-right">중간부하 발전</th>
            <th className="px-2 py-2 text-right">최대부하 발전</th>
            <th className="px-2 py-2 text-right">열 생산</th>
            <th className="px-2 py-2 text-right">가스 사용</th>
          </tr>
        </thead>
        <tbody>
          {data.데이터.map((r) => (
            <tr key={r.월} className="border-b border-zinc-100">
              <td className="px-2 py-1.5">{r.월}월</td>
              <td className="px-2 py-1.5 text-right">{fmtInt(r.일수)}</td>
              <td className="px-2 py-1.5 text-right">{fmtKW(r.계약용량_kW)}</td>
              <td className="px-2 py-1.5 text-right">
                {fmtKWh(r.월간_중간부하시간_전력생산량_kWh)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {fmtKWh(r.월간_최대부하시간_전력생산량_kWh)}
              </td>
              <td className="px-2 py-1.5 text-right">{fmtKWh(r.월간_연료전지_열생산량_kWh)}</td>
              <td className="px-2 py-1.5 text-right">{fmtKWh(r.월간_도시가스사용량_kWh)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-zinc-50 font-semibold">
          <tr>
            <td className="px-2 py-2">합계</td>
            <td className="px-2 py-2 text-right">{fmtInt(data.합계.일수)}</td>
            <td className="px-2 py-2 text-right">{fmtKW(data.합계.계약용량_kW)}</td>
            <td className="px-2 py-2 text-right">
              {fmtKWh(data.합계.월간_중간부하시간_전력생산량_kWh)}
            </td>
            <td className="px-2 py-2 text-right">
              {fmtKWh(data.합계.월간_최대부하시간_전력생산량_kWh)}
            </td>
            <td className="px-2 py-2 text-right">{fmtKWh(data.합계.월간_연료전지_열생산량_kWh)}</td>
            <td className="px-2 py-2 text-right">{fmtKWh(data.합계.월간_도시가스사용량_kWh)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
