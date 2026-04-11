'use client';

/**
 * Phase 4b — 수익 결과 표.
 */
import type { EnergyRevenueOutput } from '@/types/outputs';
import { fmtInt, fmtWon } from '@/lib/format';
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
  data: EnergyRevenueOutput;
}

export function RevenueTable({ data }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>월</TableHead>
          <TableHead className="text-right">일수</TableHead>
          <TableHead className="text-right">발전 수익</TableHead>
          <TableHead className="text-right">열 수익</TableHead>
          <TableHead className="text-right">가스 요금</TableHead>
          <TableHead className="text-right">최종 수익</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.데이터.map((r) => (
          <TableRow key={r.월}>
            <TableCell>{r.월}월</TableCell>
            <TableCell className="text-right">{fmtInt(r.일수)}</TableCell>
            <TableCell className="text-right">{fmtWon(r.발전_월간총수익_원)}</TableCell>
            <TableCell className="text-right">{fmtWon(r.열생산_월간총수익_원)}</TableCell>
            <TableCell className="text-right">{fmtWon(r.도시가스사용요금_원)}</TableCell>
            <TableCell className="text-right font-medium">
              {fmtWon(r.에너지생산_최종수익_원)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="font-semibold">
        <TableRow>
          <TableCell>합계</TableCell>
          <TableCell className="text-right">{fmtInt(data.합계.일수)}</TableCell>
          <TableCell className="text-right">{fmtWon(data.합계.발전_월간총수익_원)}</TableCell>
          <TableCell className="text-right">{fmtWon(data.합계.열생산_월간총수익_원)}</TableCell>
          <TableCell className="text-right">{fmtWon(data.합계.도시가스사용요금_원)}</TableCell>
          <TableCell className="text-right">{fmtWon(data.합계.에너지생산_최종수익_원)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
