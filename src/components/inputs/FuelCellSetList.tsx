'use client';

/**
 * 연료전지 세트 목록 — 추가/삭제, 총설치용량 자동 계산.
 *
 * 저장 액션 호출은 부모(Tab1Input → page)에서 useActionState로 묶는다.
 * 본 컴포넌트는 onChange로 현재 입력 상태를 통지한다.
 */
import { useEffect, useState } from 'react';
import type { FuelCellLibrary } from '@/types/fuelCell';
import { FuelCellSetRow, type FuelCellSetState } from './FuelCellSetRow';

interface Props {
  library: FuelCellLibrary;
  initial?: FuelCellSetState[];
  onChange?: (sets: FuelCellSetState[], totalKw: number) => void;
}

function emptySet(): FuelCellSetState {
  return {
    set_id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `set-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    형식: null,
    제조사: null,
    모델: null,
    발전용량_kW: null,
    열생산용량_kW: null,
    설치수량: null,
  };
}

function totalCapacity(sets: FuelCellSetState[]): number {
  return sets.reduce((acc, s) => {
    if (s.발전용량_kW != null && s.설치수량 != null) {
      return acc + s.발전용량_kW * s.설치수량;
    }
    return acc;
  }, 0);
}

export function FuelCellSetList({ library, initial, onChange }: Props) {
  const [sets, setSets] = useState<FuelCellSetState[]>(() =>
    initial && initial.length > 0 ? initial : [emptySet()],
  );

  const total = totalCapacity(sets);

  useEffect(() => {
    onChange?.(sets, total);
  }, [sets, total, onChange]);

  function updateAt(idx: number, next: FuelCellSetState) {
    setSets((prev) => prev.map((s, i) => (i === idx ? next : s)));
  }

  function removeAt(idx: number) {
    setSets((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function add() {
    setSets((prev) => [...prev, emptySet()]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {sets.map((s, i) => (
          <FuelCellSetRow
            key={s.set_id}
            value={s}
            library={library}
            onChange={(next) => updateAt(i, next)}
            onRemove={() => removeAt(i)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={add}
          className="px-3 py-1 border border-zinc-400 rounded text-sm hover:bg-zinc-100"
        >
          + 세트 추가
        </button>
        <div className="text-sm">
          총 설치용량: <span className="font-semibold">{total} kW</span>
        </div>
      </div>
    </div>
  );
}
