/** 전기요금라이브러리.json */
export interface ElectricityTariffRow {
  월: number;
  경부하: number;
  중간부하: number;
  최대부하: number;
}

export interface ElectricityTariffLibrary {
  요금제: string;
  기본요금_원per_kW: number;
  단위: string;
  데이터: ElectricityTariffRow[];
}

/** 가스요금라이브러리.json */
export interface GasTariffEntry {
  구분: string;
  단가_원per_kW: number;
}

export type GasTariffLibrary = GasTariffEntry[];
