'use client';

/**
 * Phase 4b — 에너지 산출 결과 표.
 * 월별 12행 + 합계 row. 계산 무효(null) 시 부모가 렌더하지 않음.
 */
import type { EnergyProductionOutput } from '@/types/outputs';
import { fmtInt, fmtKW, fmtKWh } from '@/lib/format';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface Props {
  data: EnergyProductionOutput;
}

export function EnergyProductionTable({ data }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>월</TableHead>
          <TableHead className="text-right">일수</TableHead>
          <TableHead className="text-right">계약용량</TableHead>
          <TableHead className="text-right">중간부하 발전</TableHead>
          <TableHead className="text-right">최대부하 발전</TableHead>
          <TableHead className="text-right">열 생산</TableHead>
          <TableHead className="text-right">가스 사용</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.데이터.map((r) => (
          <TableRow key={r.월}>
            <TableCell>{r.월}월</TableCell>
            <TableCell className="text-right">{fmtInt(r.일수)}</TableCell>
            <TableCell className="text-right">{fmtKW(r.계약용량_kW)}</TableCell>
            <TableCell className="text-right">
              {fmtKWh(r.월간_중간부하시간_전력생산량_kWh)}
            </TableCell>
            <TableCell className="text-right">
              {fmtKWh(r.월간_최대부하시간_전력생산량_kWh)}
            </TableCell>
            <TableCell className="text-right">{fmtKWh(r.월간_연료전지_열생산량_kWh)}</TableCell>
            <TableCell className="text-right">{fmtKWh(r.월간_도시가스사용량_kWh)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="font-semibold">
        <TableRow>
          <TableCell>합계</TableCell>
          <TableCell className="text-right">{fmtInt(data.합계.일수)}</TableCell>
          <TableCell className="text-right">{fmtKW(data.합계.계약용량_kW)}</TableCell>
          <TableCell className="text-right">
            {fmtKWh(data.합계.월간_중간부하시간_전력생산량_kWh)}
          </TableCell>
          <TableCell className="text-right">
            {fmtKWh(data.합계.월간_최대부하시간_전력생산량_kWh)}
          </TableCell>
          <TableCell className="text-right">
            {fmtKWh(data.합계.월간_연료전지_열생산량_kWh)}
          </TableCell>
          <TableCell className="text-right">{fmtKWh(data.합계.월간_도시가스사용량_kWh)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
