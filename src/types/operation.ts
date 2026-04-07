/** 월별가동일라이브러리.json */
export type OperationProfileKey = '365일가동' | '주말일부가동' | '평일가동' | '학기중가동';

export interface OperationProfile {
  연간가동일: number;
  /** 길이 12 (1~12월) */
  월별가동일: number[];
}

export type OperationLibrary = Record<OperationProfileKey, OperationProfile>;
