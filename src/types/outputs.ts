/** output1_에너지생산량및사용량.json */
export interface EnergyProductionRow {
  월: number;
  일수: number | null;
  계약용량_kW: number | null;
  월간_중간부하시간_전력생산량_kWh: number | null;
  월간_최대부하시간_전력생산량_kWh: number | null;
  월간_연료전지_열생산량_kWh: number | null;
  월간_도시가스사용량_kWh: number | null;
}

export interface EnergyProductionOutput {
  columns: string[];
  데이터: EnergyProductionRow[];
  합계: Omit<EnergyProductionRow, '월'>;
}

/** output2_에너지생산수익.json */
export interface EnergyRevenueRow {
  월: number;
  일수: number | null;
  발전_월간총수익_원: number | null;
  열생산_월간총수익_원: number | null;
  도시가스사용요금_원: number | null;
  에너지생산_최종수익_원: number | null;
}

export interface EnergyRevenueOutput {
  columns: string[];
  데이터: EnergyRevenueRow[];
  합계: Omit<EnergyRevenueRow, '월'>;
}

/** output3_연도별경제성평가결과.json */
export interface AnnualEconomicsRow {
  연도: number;
  총수익_원: number | null;
  유지보수비용_원: number | null;
  순현금흐름_원: number | null;
  누적순현금흐름_원: number | null;
  할인순현금흐름_원: number | null;
}

export interface AnnualEconomicsOutput {
  columns: string[];
  데이터: AnnualEconomicsRow[];
}

/** output4_경제성최종평가결과.json */
export interface EconomicsSummaryRow {
  기간_년: number;
  누적수익_원: number | null;
  누적유지보수비용_원: number | null;
  '초기투자비용(설치비)_원': number | null;
  총비용_원: number | null;
  ROI_초기투자: number | null;
  ROI_총비용: number | null;
  NPV_원: number | null;
  IRR: number | null;
}

export interface EconomicsSummaryOutput {
  columns: string[];
  데이터: EconomicsSummaryRow[];
}
