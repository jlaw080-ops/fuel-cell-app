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

interface MetricBadgeProps {
  label: string;
  description: string;
  valueStr: string;
  achieved: boolean | null;
}

function MetricBadge({ label, description, valueStr, achieved }: MetricBadgeProps) {
  const colorClass =
    achieved === true
      ? 'bg-green-50 border-green-200'
      : achieved === false
        ? 'bg-red-50 border-red-200'
        : 'bg-zinc-50 border-zinc-200';
  const valueCls =
    achieved === true ? 'text-green-700' : achieved === false ? 'text-red-700' : 'text-zinc-800';

  return (
    <div className={`flex-1 border rounded-lg px-3 py-2.5 ${colorClass}`}>
      <div className="text-xs font-semibold text-zinc-600">{label}</div>
      <div className="text-xs text-zinc-400 mb-1">{description}</div>
      <div className={`text-base font-bold ${valueCls}`}>{valueStr}</div>
    </div>
  );
}

interface StepToggleProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}

function StepToggle({ selected, onClick, title, subtitle }: StepToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2.5 px-3 rounded-lg border text-left transition-colors ${
        selected
          ? 'bg-zinc-900 text-white border-zinc-900'
          : 'bg-white text-zinc-600 border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className={`text-xs mt-0.5 ${selected ? 'text-zinc-400' : 'text-zinc-400'}`}>
        {subtitle}
      </div>
    </button>
  );
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

  // 현재 지표 달성 여부 (배지 색상 용)
  const irrAchieved =
    metric === 'irr' && currentIrr20 != null ? currentIrr20 >= targetNum / 100 : null;
  const paybackAchieved =
    metric === 'payback' && currentPayback != null ? currentPayback <= targetNum : null;

  // 결과 문장 조각
  const goalStatement =
    metric === 'irr' ? `IRR ${targetNum}% 이상 달성` : `회수기간 ${targetNum}년 이내 달성`;
  const solveLabel = solveFor === 'capex' ? '최대 CAPEX' : '최소 연간 발전수익';
  const deltaStr = result != null ? fmtDelta(result, currentRef) : null;
  const deltaPositive = deltaStr != null && deltaStr.startsWith('+');

  return (
    <div className="border border-zinc-200 rounded-xl p-5 bg-white space-y-5">
      {/* 현재 지표 */}
      <div>
        <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          현재 지표
        </div>
        <div className="flex gap-3">
          <MetricBadge
            label="IRR (20년)"
            description="투자수익률 · 높을수록 유리"
            valueStr={currentIrr20 != null ? `${(currentIrr20 * 100).toFixed(2)}%` : '-'}
            achieved={irrAchieved}
          />
          <MetricBadge
            label="회수기간"
            description="투자금 회수 기간 · 짧을수록 유리"
            valueStr={currentPayback != null ? `${currentPayback.toFixed(1)}년` : '회수 불가'}
            achieved={paybackAchieved}
          />
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* 3단계 입력 */}
      <div className="space-y-5">
        {/* Step 1 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-white text-xs font-bold flex-shrink-0">
              1
            </span>
            <span className="text-sm font-medium text-zinc-700">
              달성하고 싶은 목표를 선택하세요
            </span>
          </div>
          <div className="flex gap-2 ml-7">
            <StepToggle
              selected={metric === 'payback'}
              onClick={() => {
                setMetric('payback');
                setTargetRaw('7');
              }}
              title="회수기간 단축"
              subtitle="투자금을 더 빨리 회수"
            />
            <StepToggle
              selected={metric === 'irr'}
              onClick={() => {
                setMetric('irr');
                setTargetRaw('8');
              }}
              title="IRR 향상"
              subtitle="투자 수익률 높이기"
            />
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-white text-xs font-bold flex-shrink-0">
              2
            </span>
            <span className="text-sm font-medium text-zinc-700">목표값을 입력하세요</span>
          </div>
          <div className="flex items-center gap-2 ml-7">
            <span className="text-sm text-zinc-500">
              {metric === 'payback' ? '회수기간' : 'IRR'}
            </span>
            <input
              type="number"
              min={0.1}
              step={0.5}
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
              className="w-20 border border-zinc-300 rounded-lg px-2.5 py-1.5 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-400"
            />
            <span className="text-sm text-zinc-500">
              {metric === 'payback' ? '년 이내' : '% 이상'}
            </span>
          </div>
        </div>

        {/* Step 3 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 text-white text-xs font-bold flex-shrink-0">
              3
            </span>
            <span className="text-sm font-medium text-zinc-700">어떤 값을 역산할까요?</span>
          </div>
          <div className="flex gap-2 ml-7">
            <StepToggle
              selected={solveFor === 'capex'}
              onClick={() => setSolveFor('capex')}
              title="최대 CAPEX"
              subtitle="초기 투자 한도 계산"
            />
            <StepToggle
              selected={solveFor === 'elecRev'}
              onClick={() => setSolveFor('elecRev')}
              title="최소 발전수익"
              subtitle="필요 연간 수익 계산"
            />
          </div>
        </div>
      </div>

      {/* 결과 */}
      {targetValid && (
        <div
          className={`rounded-xl px-4 py-4 ${
            alreadyAchieved
              ? 'bg-green-50 border border-green-200'
              : result == null
                ? 'bg-red-50 border border-red-200'
                : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <div
            className={`text-xs font-semibold uppercase tracking-wide mb-2 ${
              alreadyAchieved ? 'text-green-500' : result == null ? 'text-red-500' : 'text-blue-500'
            }`}
          >
            역산 결과
          </div>
          {alreadyAchieved ? (
            <p className="text-green-700 font-medium text-sm">
              현재 설정으로 이미 목표를 달성하고 있습니다.
            </p>
          ) : result == null ? (
            <p className="text-red-700 text-sm">
              현재 수익 구조에서는 {goalStatement}을(를) 달성할 수 없습니다.
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500">{goalStatement}을(를) 위한 조건</p>
              <p className="font-bold text-zinc-900 text-lg">
                {solveLabel}: <span className="text-blue-700">{fmtOk(result)}</span>
              </p>
              <p className="text-xs text-zinc-500">
                현재 대비{' '}
                <span
                  className={
                    deltaPositive ? 'text-green-600 font-medium' : 'text-red-600 font-medium'
                  }
                >
                  {deltaStr}
                </span>
                {' — '}
                {solveFor === 'capex'
                  ? '이 금액 이하로 투자하면 목표를 달성할 수 있습니다.'
                  : '연간 발전수익이 이 수준 이상이어야 목표를 달성할 수 있습니다.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
