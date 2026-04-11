'use client';

/**
 * 연료전지 세트 한 행 — 캐스케이딩 드롭다운 (형식 → 제조사 → 모델) + 설치수량.
 *
 * 상태는 부모(FuelCellSetList)에서 관리하고, 본 컴포넌트는 onChange로 변경만 통지.
 * 모델 선택 시 발전용량/열생산용량은 라이브러리에서 자동 채워진다.
 */
import { useMemo } from 'react';
import type { FuelCellLibrary, FuelCellType } from '@/types/fuelCell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FuelCellSetState {
  set_id: string;
  형식: FuelCellType | null;
  제조사: string | null;
  모델: string | null;
  발전용량_kW: number | null;
  열생산용량_kW: number | null;
  설치수량: number | null;
  kW당설치단가_override?: number | null;
  kW당연간유지비용_override?: number | null;
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
      // 모델 변경 시 override 초기화
      kW당설치단가_override: null,
      kW당연간유지비용_override: null,
    });
  }

  // 라이브러리에서 현재 선택된 모델의 단가/유지비가 null인지 판정
  const selectedProduct = models.find((p) => p.모델명 === value.모델);
  const needsCapexOverride = !!selectedProduct && selectedProduct.kW당설치단가 == null;
  const needsMaintOverride = !!selectedProduct && selectedProduct.kW당연간유지비용 == null;

  function handleCapexOverride(raw: string) {
    const n = raw === '' ? null : Number(raw);
    onChange({
      ...value,
      kW당설치단가_override: Number.isFinite(n) ? n : null,
    });
  }
  function handleMaintOverride(raw: string) {
    const n = raw === '' ? null : Number(raw);
    onChange({
      ...value,
      kW당연간유지비용_override: Number.isFinite(n) ? n : null,
    });
  }

  function handleQty(raw: string) {
    const n = raw === '' ? null : Number(raw);
    onChange({ ...value, 설치수량: Number.isFinite(n) ? n : null });
  }

  return (
    <Card size="sm">
      <CardContent className="space-y-2">
        {/* 형식 / 제조사 */}
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={value.형식 ?? ''}
            onValueChange={(v) => handleType((v || null) as FuelCellType | null)}
          >
            <SelectTrigger aria-label="형식" size="sm" className="w-full">
              <SelectValue placeholder="형식" />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={value.제조사 ?? ''}
            disabled={!value.형식}
            onValueChange={(v) => handleManufacturer(v || null)}
          >
            <SelectTrigger aria-label="제조사" size="sm" className="w-full">
              <SelectValue placeholder="제조사" />
            </SelectTrigger>
            <SelectContent>
              {manufacturers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 모델 (full width) */}
        <Select
          value={value.모델 ?? ''}
          disabled={!value.제조사}
          onValueChange={(v) => handleModel(v || null)}
        >
          <SelectTrigger aria-label="모델" size="sm" className="w-full">
            <SelectValue placeholder="모델" />
          </SelectTrigger>
          <SelectContent>
            {models.map((p) => (
              <SelectItem key={p.모델명!} value={p.모델명!}>
                {p.모델명}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 용량 / 수량 / 삭제 */}
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm text-zinc-600">
            {value.발전용량_kW != null ? `${value.발전용량_kW} kW` : '-'}
          </span>
          <Input
            aria-label="설치수량"
            type="number"
            min={1}
            className="w-16 text-right"
            value={value.설치수량 ?? ''}
            onChange={(e) => handleQty(e.target.value)}
            placeholder="수량"
          />
          <Button
            type="button"
            onClick={onRemove}
            variant="destructive"
            size="sm"
            className="shrink-0"
          >
            삭제
          </Button>
        </div>

        {(needsCapexOverride || needsMaintOverride) && (
          <div className="mt-1 flex flex-col gap-2 bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            <div className="text-amber-800">
              이 모델은 라이브러리 단가가 없습니다. 직접 입력하세요.
            </div>
            {needsCapexOverride && (
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-700 shrink-0">kW당 설치단가 (원)</span>
                <Input
                  type="number"
                  min={0}
                  value={value.kW당설치단가_override ?? ''}
                  onChange={(e) => handleCapexOverride(e.target.value)}
                  className="flex-1 min-w-0"
                  placeholder="예: 10000000"
                />
              </label>
            )}
            {needsMaintOverride && (
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-700 shrink-0">kW당 연간유지비 (원)</span>
                <Input
                  type="number"
                  min={0}
                  value={value.kW당연간유지비용_override ?? ''}
                  onChange={(e) => handleMaintOverride(e.target.value)}
                  className="flex-1 min-w-0"
                  placeholder="예: 2200000"
                />
              </label>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
