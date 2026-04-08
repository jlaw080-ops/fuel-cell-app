'use client';

/**
 * Phase 6c — 시나리오 비교 (최대 4개).
 *
 * /reports/compare?ids=a,b,c → 각 리포트 로드 후 핵심지표 나란히.
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
      <div className="flex items-center gap-3">
        <Link href="/reports" className="text-sm text-blue-600 underline">
          ← 리포트 목록
        </Link>
        <span className="flex-1" />
        <span className="text-xs text-zinc-500">{items.length}건 비교</span>
      </div>
      {errs.length > 0 && <div className="text-sm text-red-600">로드 실패: {errs.join(', ')}</div>}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left">항목</th>
                {items.map((it) => (
                  <th key={it.id} className="px-3 py-2 text-left">
                    {it.title ?? '(제목 없음)'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows(items).map((row) => (
                <tr key={row.label} className="border-t border-zinc-200">
                  <td className="px-3 py-2 font-medium text-zinc-700">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-3 py-2 text-right">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function rows(items: Loaded[]): { label: string; values: string[] }[] {
  const get = (it: Loaded) => {
    const e = it.snapshot.results.economics;
    const s20 = e.summary.데이터.find((r) => r.기간_년 === 20);
    return {
      capacity: it.snapshot.inputs.fuelCell.총설치용량_kW,
      capex: e.capex,
      lcoe: e.lcoe_원per_kWh,
      payback: it.snapshot.results.paybackYears,
      npv: s20?.NPV_원 ?? null,
      irr: s20?.IRR ?? null,
      roi: s20?.ROI_초기투자 ?? null,
      maint: e.baseAnnualMaintenance,
      lifetime: it.snapshot.settings.lifetime,
      discount: it.snapshot.settings.discountRate,
    };
  };
  const data = items.map(get);
  return [
    { label: '총 설치용량', values: data.map((d) => fmtKW(d.capacity)) },
    { label: 'CAPEX', values: data.map((d) => fmtWon(d.capex)) },
    { label: 'LCOE', values: data.map((d) => fmtWonPerKWh(d.lcoe)) },
    { label: '연간 유지비', values: data.map((d) => fmtWon(d.maint)) },
    {
      label: '회수기간',
      values: data.map((d) => (d.payback == null ? '회수 불가' : fmtYears(d.payback))),
    },
    { label: '20년 NPV', values: data.map((d) => fmtWon(d.npv)) },
    { label: '20년 IRR', values: data.map((d) => fmtPct(d.irr)) },
    { label: '20년 ROI', values: data.map((d) => fmtPct(d.roi)) },
    { label: '분석기간', values: data.map((d) => `${d.lifetime} 년`) },
    { label: '할인율', values: data.map((d) => fmtPct(d.discount)) },
  ];
}
