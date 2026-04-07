/** 연료전지제품라이브러리.json 항목 */
export type FuelCellType = 'PEMFC' | 'SOFC' | 'PAFC';

export interface FuelCellProduct {
  형식: FuelCellType;
  제조사: string;
  모델명: string | null;
  정격발전용량_kW: number;
  열생산용량_kW: number | null;
  가스소비량_kW: number | null;
  발전효율: number;
  열회수효율: number | null;
  kW당설치단가: number | null;
  kW당연간유지비용: number | null;
}

export type FuelCellLibrary = FuelCellProduct[];
