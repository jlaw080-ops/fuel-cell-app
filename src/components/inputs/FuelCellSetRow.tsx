'use client';

/**
 * 연료전지 세트 한 행 — 캐스케이딩 드롭다운 (형식 → 제조사 → 모델) + 설치수량.
 *
 * 상태는 부모(FuelCellSetList)에서 관리하고, 본 컴포넌트는 onChange로 변경만 통지.
 * 모델 선택 시 발전용량/열생산용량은 라이브러리에서 자동 채워진다.
 */
import { useMemo } from 'react';
import type { FuelCellLibrary, FuelCellType } from '@/types/fuelCell';

export interface FuelCellSetState {
  set_id: string;
  형식: FuelCellType | null;
  제조사: string | null;
  모델: string | null;
  발전용량_kW: number | null;
  열생산용량_kW: number | null;
  설치수량: number | null;
}

interface Props {
  value: FuelCellSetState;
  library: FuelCellLibrary;
  onChange: (next: FuelCellSetState) => void;
  onRemove: () => void;
}

const TYPES: FuelCellType[] = ['PEMFC', 'SOFC', 'PAFC'];

export function FuelCellSetRow({ value, library, onChange, onRemove }: Props) {
  // 형식별 제조사 / 제조사별 모델 후보 계산
  const manufacturers = useMemo(() => {
    if (!value.형식) return [];
    return Array.from(new Set(library.filter((p) => p.형식 === value.형식).map((p) => p.제조사)));
  }, [library, value.형식]);

  const models = useMemo(() => {
    if (!value.형식 || !value.제조사) return [];
    return library.filter(
      (p) => p.형식 === value.형식 && p.제조사 === value.제조사 && p.모델명 !== null,
    );
  }, [library, value.형식, value.제조사]);

  function handleType(next: FuelCellType | null) {
    onChange({
      ...value,
      형식: next,
      제조사: null,
      모델: null,
      발전용량_kW: null,
      열생산용량_kW: null,
    });
  }

  function handleManufacturer(next: string | null) {
    onChange({
      ...value,
      제조사: next,
      모델: null,
      발전용량_kW: null,
      열생산용량_kW: null,
    });
  }

  function handleModel(next: string | null) {
    const product = models.find((p) => p.모델명 === next);
    onChange({
      ...value,
      모델: next,
      발전용량_kW: product?.정격발전용량_kW ?? null,
      열생산용량_kW: product?.열생산용량_kW ?? null,
    });
  }

  function handleQty(raw: string) {
    const n = raw === '' ? null : Number(raw);
    onChange({ ...value, 설치수량: Number.isFinite(n) ? n : null });
  }

  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-zinc-200 p-3 rounded">
      <select
        aria-label="형식"
        className="col-span-2 border border-zinc-300 rounded px-2 py-1"
        value={value.형식 ?? ''}
        onChange={(e) => handleType((e.target.value || null) as FuelCellType | null)}
      >
        <option value="">형식</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        aria-label="제조사"
        className="col-span-3 border border-zinc-300 rounded px-2 py-1 disabled:bg-zinc-100"
        value={value.제조사 ?? ''}
        disabled={!value.형식}
        onChange={(e) => handleManufacturer(e.target.value || null)}
      >
        <option value="">제조사</option>
        {manufacturers.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <select
        aria-label="모델"
        className="col-span-3 border border-zinc-300 rounded px-2 py-1 disabled:bg-zinc-100"
        value={value.모델 ?? ''}
        disabled={!value.제조사}
        onChange={(e) => handleModel(e.target.value || null)}
      >
        <option value="">모델</option>
        {models.map((p) => (
          <option key={p.모델명!} value={p.모델명!}>
            {p.모델명}
          </option>
        ))}
      </select>

      <div className="col-span-2 text-sm text-zinc-600 text-right">
        {value.발전용량_kW != null ? `${value.발전용량_kW} kW` : '-'}
      </div>

      <input
        aria-label="설치수량"
        type="number"
        min={1}
        className="col-span-1 border border-zinc-300 rounded px-2 py-1 text-right"
        value={value.설치수량 ?? ''}
        onChange={(e) => handleQty(e.target.value)}
        placeholder="수량"
      />

      <button
        type="button"
        onClick={onRemove}
        className="col-span-1 text-red-600 text-sm hover:underline"
      >
        삭제
      </button>
    </div>
  );
}
