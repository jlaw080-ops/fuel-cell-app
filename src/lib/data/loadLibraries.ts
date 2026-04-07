/**
 * 라이브러리 JSON 로딩 헬퍼.
 *
 * 서버 컴포넌트 / Server Action에서 사용. 빌드 타임에 정적 import로 번들링되며
 * 런타임마다 zod 검증을 통과한 데이터를 반환한다.
 *
 * 한국어 파일명을 직접 import하기 위해 src/data/index.ts 우회 없이 직접 참조.
 */
import fuelCellRaw from '@/data/연료전지제품라이브러리.json';
import operationRaw from '@/data/월별가동일라이브러리.json';
import electricityRaw from '@/data/전기요금라이브러리.json';
import gasRaw from '@/data/가스요금라이브러리.json';

import {
  fuelCellLibrarySchema,
  operationLibrarySchema,
  electricityTariffLibrarySchema,
  gasTariffLibrarySchema,
} from '@/lib/schemas/library';

import type { FuelCellLibrary } from '@/types/fuelCell';
import type { OperationLibrary } from '@/types/operation';
import type { ElectricityTariffLibrary, GasTariffLibrary } from '@/types/tariff';

export function loadFuelCellLibrary(): FuelCellLibrary {
  return fuelCellLibrarySchema.parse(fuelCellRaw);
}

export function loadOperationLibrary(): OperationLibrary {
  return operationLibrarySchema.parse(operationRaw) as OperationLibrary;
}

export function loadElectricityTariff(): ElectricityTariffLibrary {
  return electricityTariffLibrarySchema.parse(electricityRaw);
}

export function loadGasTariff(): GasTariffLibrary {
  return gasTariffLibrarySchema.parse(gasRaw);
}

export interface AllLibraries {
  fuelCell: FuelCellLibrary;
  operation: OperationLibrary;
  electricity: ElectricityTariffLibrary;
  gas: GasTariffLibrary;
}

export function loadAllLibraries(): AllLibraries {
  return {
    fuelCell: loadFuelCellLibrary(),
    operation: loadOperationLibrary(),
    electricity: loadElectricityTariff(),
    gas: loadGasTariff(),
  };
}
