'use client';

/**
 * Phase 8-3 — 목표 IRR / 회수기간 역산 패널.
 *
 * 사용자가 원하는 목표 지표(IRR 또는 회수기간)와
 * 역산할 변수(최대 CAPEX 또는 필요 발전수익)를 선택하면
 * 이진탐색으로 해당 임계값을 즉시 계산해 보여준다.
 */
import { useMemo, useState } from 'react';
import {
  solveCapexForTargetIrr,
  solveCapexForTargetPayback,
  solveElecRevForTargetIrr,
  solveElecRevForTargetPayback,
  type InverseCalcInput,
} from '@/lib/calc/inverse';

function fmtOk(n: number): string {
  const uk = n / 1e8;
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(uk)} 억원`;
}

function fmtDelta(solved: number, current: number): string {
  const pct = ((solved - current) / current) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

type MetricType = 'payback' | 'irr';
type SolveFor = 'capex' | 'elecRev';

interface Props {
  input: InverseCalcInput;
  /** 현재 계산된 20년 IRR (소수, null 가능) */
  currentIrr20: number | null;
  /** 현재 단순 회수기간 (년, null 가능) */
  currentPayback: number | null;
}

export function InverseCalcPanel({ input, currentIrr20, currentPayback }: Props) {
  const [metric, setMetric] = useState<MetricType>('payback');
  const [solveFor, setSolveFor] = useState<SolveFor>('capex');
  const [targetRaw, setTargetRaw] = useState<string>('7');

  const targetNum = Number(targetRaw);
  const targetValid = Number.isFinite(targetNum) && targetNum > 0;

  const result = useMemo<number | null>(() => {
    if (!targetValid) return null;
    if (metric === 'irr') {
      const targetIrr = targetNum / 100;
      return solveFor === 'capex'
        ? solveCapexForTargetIrr(targetIrr, input)
        : solveElecRevForTargetIrr(targetIrr, input);
    } else {
      return solveFor === 'capex'
        ? solveCapexForTargetPayback(targetNum, input)
        : solveElecRevForTargetPayback(targetNum, input);
    }
  }, [metric, solveFor, targetNum, targetValid, input]);

  // 목표 달성 여부 (현재값 기준)
  const alreadyAchieved = useMemo(() => {
    if (metric === 'irr') {
      if (currentIrr20 == null) return false;
      return currentIrr20 >= targetNum / 100;
    } else {
      if (currentPayback == null) return false;
      return currentPayback <= targetNum;
    }
  }, [metric, targetNum, currentIrr20, currentPayback]);

  const currentRef = solveFor === 'capex' ? input.capex : input.baseElecRev;
  const solveLabel = solveFor === 'capex' ? '최대 CAPEX' : '최소 발전수익 (연간)';
  const metricUnit = metric === 'irr' ? '%' : '년';

  return (
    <div className="border border-zinc-200 rounded-lg p-4 bg-white space-y-4">
      {/* 현재 지표 요약 */}
      <div className="flex gap-6 text-sm text-zinc-600">
        <span>
          현재 IRR (20년){' '}
          <strong className="text-zinc-900">
            {currentIrr20 != null ? `${(currentIrr20 * 100).toFixed(2)}%` : '-'}
          </strong>
        </span>
        <span>
          현재 회수기간{' '}
          <strong className="text-zinc-900">
            {currentPayback != null ? `${currentPayback.toFixed(2)} 년` : '회수 불가'}
          </strong>
        </span>
      </div>

      {/* 입력 행 */}
      <div className="flex flex-wrap gap-3 items-end text-sm">
        {/* 목표 지표 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">목표 지표</span>
          <div className="flex rounded border border-zinc-300 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMetric('payback');
                setTargetRaw('7');
              }}
              className={`px-3 py-1.5 ${metric === 'payback' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              회수기간
            </button>
            <button
              type="button"
              onClick={() => {
                setMetric('irr');
                setTargetRaw('8');
              }}
              className={`px-3 py-1.5 ${metric === 'irr' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              IRR
            </button>
          </div>
        </div>

        {/* 역산 변수 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">역산 변수</span>
          <div className="flex rounded border border-zinc-300 overflow-hidden text-xs font-medium">
            <button
              type="button"
              onClick={() => setSolveFor('capex')}
              className={`px-3 py-1.5 ${solveFor === 'capex' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              최대 CAPEX
            </button>
            <button
              type="button"
              onClick={() => setSolveFor('elecRev')}
              className={`px-3 py-1.5 ${solveFor === 'elecRev' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}
            >
              필요 발전수익
            </button>
          </div>
        </div>

        {/* 목표값 */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">목표값</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0.1}
              step={metric === 'irr' ? 0.5 : 0.5}
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
              className="w-20 border border-zinc-300 rounded px-2 py-1.5 text-sm"
            />
            <span className="text-zinc-500 text-sm">{metricUnit}</span>
          </div>
        </div>
      </div>

      {/* 결과 */}
      {targetValid && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            alreadyAchieved
              ? 'bg-green-50 border border-green-200'
              : result == null
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
          }`}
        >
          {alreadyAchieved ? (
            <p className="text-green-700 font-medium">
              현재 설정으로 이미 목표를 달성하고 있습니다.
            </p>
          ) : result == null ? (
            <p className="text-red-700">
              현재 수익 구조에서는 목표{' '}
              {metric === 'irr' ? `IRR ${targetNum}%` : `회수기간 ${targetNum}년`}
              을(를) 달성할 수 없습니다.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="font-medium text-zinc-800">
                {solveLabel}: <span className="text-blue-700">{fmtOk(result)}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  ({fmtDelta(result, currentRef)} vs 현재)
                </span>
              </p>
              <p className="text-xs text-zinc-500">
                {solveFor === 'capex'
                  ? `이 금액 이하로 투자하면 목표 ${metric === 'irr' ? `IRR ${targetNum}%` : `회수기간 ${targetNum}년`}을(를) 달성할 수 있습니다.`
                  : `연간 발전수익이 이 수준 이상이면 목표 ${metric === 'irr' ? `IRR ${targetNum}%` : `회수기간 ${targetNum}년`}을(를) 달성할 수 있습니다.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
