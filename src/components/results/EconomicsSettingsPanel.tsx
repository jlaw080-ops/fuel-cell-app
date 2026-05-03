'use client';

import { useState } from 'react';
import { DEFAULTS, type MaintenanceMode } from '@/lib/calc/economics/economics';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface EconomicsSettings {
  lifetime: number;
  discountRate: number; // 소수 (0.02 = 2%)
  maintenanceMode: MaintenanceMode;
  maintenanceRatio: number; // 소수
  electricityEscalation: number;
  gasEscalation: number;
  maintenanceEscalation: number;
  boilerEfficiency: number;
}

export const DEFAULT_SETTINGS: EconomicsSettings = {
  lifetime: DEFAULTS.lifetime,
  discountRate: DEFAULTS.discountRate,
  maintenanceMode: DEFAULTS.maintenanceMode,
  maintenanceRatio: DEFAULTS.maintenanceRatio,
  electricityEscalation: DEFAULTS.electricityEscalation,
  gasEscalation: DEFAULTS.gasEscalation,
  maintenanceEscalation: DEFAULTS.maintenanceEscalation,
  boilerEfficiency: 0.85,
};

interface Props {
  value: EconomicsSettings;
  onChange: (next: EconomicsSettings) => void;
}

// 사용자는 퍼센트로 입력, 내부는 소수
function pctToNum(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : 0;
}

export function EconomicsSettingsPanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function update<K extends keyof EconomicsSettings>(key: K, v: EconomicsSettings[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="border border-zinc-200 rounded bg-zinc-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-left hover:bg-zinc-100 transition-colors"
      >
        <span>경제성 입력값 (기본값 사용 중 — 클릭하여 수정)</span>
        <span className="text-zinc-400 text-xs">{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 250ms ease',
        }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 grid grid-cols-2 gap-4 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">분석기간 (년)</span>
              <Input
                type="number"
                min={1}
                max={50}
                value={value.lifetime}
                onChange={(e) => update('lifetime', Number(e.target.value) || 0)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">할인율 (%, 명목)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.discountRate * 100}
                onChange={(e) => update('discountRate', pctToNum(e.target.value))}
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-zinc-600">유지보수 모드</span>
              <Select
                value={value.maintenanceMode}
                onValueChange={(v) => update('maintenanceMode', v as MaintenanceMode)}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixedCost">라이브러리 단가 (kW당 연간유지비용)</SelectItem>
                  <SelectItem value="ratio">초기투자비 대비 비율</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">유지보수 비율 (%, ratio 모드만)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.maintenanceRatio * 100}
                disabled={value.maintenanceMode !== 'ratio'}
                onChange={(e) => update('maintenanceRatio', pctToNum(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">전기요금 상승률 (%)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.electricityEscalation * 100}
                onChange={(e) => update('electricityEscalation', pctToNum(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">가스요금 상승률 (%)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.gasEscalation * 100}
                onChange={(e) => update('gasEscalation', pctToNum(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">유지보수 상승률 (%)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.maintenanceEscalation * 100}
                onChange={(e) => update('maintenanceEscalation', pctToNum(e.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-zinc-600">가스보일러 효율 (%)</span>
              <Input
                type="number"
                step={0.1}
                defaultValue={value.boilerEfficiency * 100}
                onChange={(e) => update('boilerEfficiency', pctToNum(e.target.value))}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
