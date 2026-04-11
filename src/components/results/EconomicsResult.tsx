'use client';

/**
 * Phase 4d — 경제성 결과 (카드 + 연도별 21행 표 + Summary 표).
 */
import type { EconomicsResult as EconResult } from '@/lib/calc/economics/economics';
import { fmtWon, fmtWonPerKWh, fmtYears, fmtPct } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
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
  result: EconResult;
  payback: number | null;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function EconomicsResult({ result, payback }: Props) {
  return (
    <div className="space-y-6">
      {/* 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="초기투자비 (CAPEX)" value={fmtWon(result.capex)} />
        <StatCard label="기준 연간 유지보수비" value={fmtWon(result.baseAnnualMaintenance)} />
        <StatCard label="LCOE (전기)" value={fmtWonPerKWh(result.lcoe_원per_kWh)} />
        <StatCard
          label="회수기간 (단순)"
          value={payback == null ? '회수 불가' : fmtYears(payback)}
        />
      </div>

      {/* 연도별 표 */}
      <div>
        <h4 className="text-sm font-semibold mb-2">
          연도별 현금흐름 ({result.annual.데이터.length - 1}년)
        </h4>
        <div className="max-h-96 overflow-auto rounded border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 bg-background">
                <TableHead>연도</TableHead>
                <TableHead className="text-right">총수익</TableHead>
                <TableHead className="text-right">유지보수비</TableHead>
                <TableHead className="text-right">순현금흐름</TableHead>
                <TableHead className="text-right">누적</TableHead>
                <TableHead className="text-right">할인</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.annual.데이터.map((r) => (
                <TableRow key={r.연도}>
                  <TableCell>{r.연도}년</TableCell>
                  <TableCell className="text-right">{fmtWon(r.총수익_원)}</TableCell>
                  <TableCell className="text-right">{fmtWon(r.유지보수비용_원)}</TableCell>
                  <TableCell className="text-right">{fmtWon(r.순현금흐름_원)}</TableCell>
                  <TableCell
                    className={
                      'text-right ' +
                      ((r.누적순현금흐름_원 ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')
                    }
                  >
                    {fmtWon(r.누적순현금흐름_원)}
                  </TableCell>
                  <TableCell className="text-right">{fmtWon(r.할인순현금흐름_원)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Summary */}
      <div>
        <h4 className="text-sm font-semibold mb-2">기간별 요약</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>기간</TableHead>
              <TableHead className="text-right">누적 수익</TableHead>
              <TableHead className="text-right">누적 유지비</TableHead>
              <TableHead className="text-right">총비용</TableHead>
              <TableHead className="text-right">ROI (투자)</TableHead>
              <TableHead className="text-right">ROI (총비용)</TableHead>
              <TableHead className="text-right">NPV</TableHead>
              <TableHead className="text-right">IRR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.summary.데이터.map((r) => (
              <TableRow key={r.기간_년}>
                <TableCell>{r.기간_년}년</TableCell>
                <TableCell className="text-right">{fmtWon(r.누적수익_원)}</TableCell>
                <TableCell className="text-right">{fmtWon(r.누적유지보수비용_원)}</TableCell>
                <TableCell className="text-right">{fmtWon(r.총비용_원)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.ROI_초기투자)}</TableCell>
                <TableCell className="text-right">{fmtPct(r.ROI_총비용)}</TableCell>
                <TableCell
                  className={
                    'text-right ' + ((r.NPV_원 ?? 0) >= 0 ? 'text-green-700' : 'text-red-600')
                  }
                >
                  {fmtWon(r.NPV_원)}
                </TableCell>
                <TableCell className="text-right">{fmtPct(r.IRR)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
