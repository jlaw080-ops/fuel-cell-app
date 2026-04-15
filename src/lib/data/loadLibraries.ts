/**
 * 라이브러리 Supabase 로딩 헬퍼.
 *
 * 서버 컴포넌트 / Server Action에서 사용.
 * Supabase 테이블에서 런타임에 데이터를 조회하고
 * zod 검증을 통과한 데이터를 반환한다.
 */
import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import {
  fuelCellLibrarySchema,
  operationLibrarySchema,
  electricityTariffLibrarySchema,
  gasTariffLibrarySchema,
} from '@/lib/schemas/library';

import type { FuelCellLibrary } from '@/types/fuelCell';
import type { OperationLibrary } from '@/types/operation';
import type { ElectricityTariffLibrary, GasTariffLibrary } from '@/types/tariff';

export async function loadFuelCellLibrary(): Promise<FuelCellLibrary> {
  const { data, error } = await supabaseServer.from('fuel_cell_products').select('*').order('id');

  if (error) throw new Error(`fuel_cell_products 로드 실패: ${error.message}`);

  const mapped = (data ?? []).map((row) => ({
    형식: row.type,
    제조사: row.manufacturer,
    모델명: row.model_name,
    정격발전용량_kW: row.rated_power_kw,
    열생산용량_kW: row.heat_output_kw,
    가스소비량_kW: row.gas_input_kw,
    발전효율: row.electric_efficiency,
    열회수효율: row.heat_recovery_efficiency,
    kW당설치단가: row.install_cost_per_kw,
    kW당연간유지비용: row.om_cost_per_kw_year,
  }));

  return fuelCellLibrarySchema.parse(mapped);
}

export async function loadOperationLibrary(): Promise<OperationLibrary> {
  const { data, error } = await supabaseServer.from('operation_profiles').select('*').order('id');

  if (error) throw new Error(`operation_profiles 로드 실패: ${error.message}`);

  const record: Record<string, { 연간가동일: number; 월별가동일: number[] }> = {};
  for (const row of data ?? []) {
    record[row.name] = {
      연간가동일: row.annual_days,
      월별가동일: row.monthly_days,
    };
  }

  return operationLibrarySchema.parse(record) as OperationLibrary;
}

export async function loadElectricityTariff(): Promise<ElectricityTariffLibrary> {
  const { data: plans, error: planError } = await supabaseServer
    .from('electricity_tariff_plans')
    .select('*, electricity_tariff_monthly(*)')
    .eq('is_active', true)
    .order('id')
    .limit(1)
    .single();

  if (planError) throw new Error(`electricity_tariff_plans 로드 실패: ${planError.message}`);

  const monthly = (
    plans.electricity_tariff_monthly as {
      month: number;
      off_peak: number;
      mid_peak: number;
      on_peak: number;
    }[]
  ).sort((a, b) => a.month - b.month);

  const mapped = {
    요금제: plans.plan_name,
    기본요금_원per_kW: plans.base_charge_per_kw,
    단위: plans.unit,
    데이터: monthly.map((r) => ({
      월: r.month,
      경부하: r.off_peak,
      중간부하: r.mid_peak,
      최대부하: r.on_peak,
    })),
  };

  return electricityTariffLibrarySchema.parse(mapped);
}

export async function loadGasTariff(): Promise<GasTariffLibrary> {
  const { data, error } = await supabaseServer.from('gas_tariffs').select('*').order('id');

  if (error) throw new Error(`gas_tariffs 로드 실패: ${error.message}`);

  const mapped = (data ?? []).map((row) => ({
    구분: row.name,
    단가_원per_kW: row.unit_price_per_kwh,
  }));

  return gasTariffLibrarySchema.parse(mapped);
}

export interface AllLibraries {
  fuelCell: FuelCellLibrary;
  operation: OperationLibrary;
  electricity: ElectricityTariffLibrary;
  gas: GasTariffLibrary;
}

export async function loadAllLibraries(): Promise<AllLibraries> {
  const [fuelCell, operation, electricity, gas] = await Promise.all([
    loadFuelCellLibrary(),
    loadOperationLibrary(),
    loadElectricityTariff(),
    loadGasTariff(),
  ]);

  return { fuelCell, operation, electricity, gas };
}
