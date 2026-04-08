import type { FuelCellType } from './fuelCell';
import type { OperationProfileKey } from './operation';

/** Input1_연료전지정보.json */
export interface FuelCellInputSet {
  set_id: string;
  형식: FuelCellType | null;
  제조사: string | null;
  모델: string | null;
  발전용량_kW: number | null;
  열생산용량_kW: number | null;
  설치수량: number | null;
  /** 라이브러리 kW당설치단가가 null인 모델에 대한 사용자 입력 fallback. */
  kW당설치단가_override?: number | null;
  /** 라이브러리 kW당연간유지비용이 null인 모델에 대한 사용자 입력 fallback. */
  kW당연간유지비용_override?: number | null;
}

export interface FuelCellInput {
  sets: FuelCellInputSet[];
  총설치용량_kW: number | null;
}

/** Input2_운전시간정보.json */
export interface OperationInput {
  연간운전유형: OperationProfileKey | null;
  연간운전일수: number | null;
  일일_중간부하_운전시간: number;
  일일_최대부하_운전시간: number;
}
