'use client';

/**
 * 운전 프로필 선택 + 일일 운전시간 입력 (Input2).
 *
 * - 운전유형 드롭다운 → 선택 시 월별 가동일 read-only 표시
 * - 일일 중간부하 / 최대부하 운전시간 입력 (0~24, 합계 ≤ 24)
 * - 합계 초과 시 inline 에러 메시지
 *
 * 상태는 내부 useState로 관리하고 onChange로 부모에 통지.
 * 저장 액션 호출은 부모(2-9 페이지 통합)에서 처리한다.
 */
import { useEffect, useState } from 'react';
import type { OperationLibrary, OperationProfileKey } from '@/types/operation';

export interface OperationInputState {
  연간운전유형: OperationProfileKey | null;
  연간운전일수: number | null;
  일일_중간부하_운전시간: number;
  일일_최대부하_운전시간: number;
}

interface Props {
  library: OperationLibrary;
  initial?: Partial<OperationInputState>;
  onChange?: (value: OperationInputState, valid: boolean) => void;
}

const PROFILE_KEYS: OperationProfileKey[] = ['365일가동', '주말일부가동', '평일가동', '학기중가동'];

const MONTHS = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
];

function clampHour(raw: string): number {
  if (raw === '') return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(24, n));
}

export function OperationProfileSelector({ library, initial, onChange }: Props) {
  const [state, setState] = useState<OperationInputState>(() => ({
    연간운전유형: initial?.연간운전유형 ?? null,
    연간운전일수: initial?.연간운전일수 ?? null,
    일일_중간부하_운전시간: initial?.일일_중간부하_운전시간 ?? 16,
    일일_최대부하_운전시간: initial?.일일_최대부하_운전시간 ?? 8,
  }));

  const profile = state.연간운전유형 ? library[state.연간운전유형] : null;
  const sumHours = state.일일_중간부하_운전시간 + state.일일_최대부하_운전시간;
  const hoursValid = sumHours <= 24;
  const valid = state.연간운전유형 !== null && hoursValid;

  useEffect(() => {
    onChange?.(state, valid);
  }, [state, valid, onChange]);

  function handleProfile(next: OperationProfileKey | null) {
    setState((prev) => ({
      ...prev,
      연간운전유형: next,
      연간운전일수: next ? library[next].연간가동일 : null,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="text-sm shrink-0 w-24">연간 운전유형</label>
        <select
          aria-label="연간 운전유형"
          className="flex-1 min-w-[8rem] border border-[#3d3a39] rounded px-2 py-1 text-sm bg-[#101010] text-[#f2f2f2]"
          value={state.연간운전유형 ?? ''}
          onChange={(e) => handleProfile((e.target.value || null) as OperationProfileKey | null)}
        >
          <option value="">선택</option>
          {PROFILE_KEYS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <div className="text-sm text-[#8b949e] shrink-0">
          {profile ? `연간 ${profile.연간가동일}일 가동` : '-'}
        </div>
      </div>

      {profile && (
        <div className="border border-[#3d3a39] rounded p-3 bg-[#101010]">
          <div className="text-sm font-medium mb-2">월별 가동일 (read-only)</div>
          <div className="grid grid-cols-4 sm:grid-cols-12 gap-1 text-center text-xs">
            {MONTHS.map((m, i) => (
              <div key={m} className="space-y-1">
                <div className="text-[#8b949e]">{m}</div>
                <div className="font-mono">{profile.월별가동일[i]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm shrink-0">중간부하</label>
          <input
            aria-label="일일 중간부하 운전시간"
            type="number"
            min={0}
            max={24}
            step="0.5"
            className="w-16 border border-[#3d3a39] rounded px-2 py-1 text-right text-sm bg-[#101010] text-[#f2f2f2]"
            value={state.일일_중간부하_운전시간}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                일일_중간부하_운전시간: clampHour(e.target.value),
              }))
            }
          />
          <span className="text-sm text-[#8b949e]">h</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm shrink-0">최대부하</label>
          <input
            aria-label="일일 최대부하 운전시간"
            type="number"
            min={0}
            max={24}
            step="0.5"
            className="w-16 border border-[#3d3a39] rounded px-2 py-1 text-right text-sm bg-[#101010] text-[#f2f2f2]"
            value={state.일일_최대부하_운전시간}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                일일_최대부하_운전시간: clampHour(e.target.value),
              }))
            }
          />
          <span className="text-sm text-[#8b949e]">h</span>
        </div>
      </div>

      <div className="text-sm">
        합계: <span className="font-semibold">{sumHours} h</span> / 24h
        {!hoursValid && (
          <span className="ml-2 text-red-400">
            ⚠ 중간부하 + 최대부하 합계가 24시간을 초과합니다.
          </span>
        )}
      </div>
    </div>
  );
}
