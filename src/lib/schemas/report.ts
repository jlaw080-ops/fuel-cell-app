/**
 * Phase 5 — 리포트 스냅샷 zod 스키마.
 *
 * 입력(FuelCell/Operation) + 계산 결과(Production/Revenue/Economics) + 설정 + 메타
 * 전체를 jsonb로 저장하기 위한 구조.
 */
import { z } from 'zod';
import { fuelCellInputSchema, operationInputSchema } from './inputs';

// 숫자 필드를 nullable로 받는 헬퍼 (출력 타입 미러)
const nn = () => z.number().nullable();

const energyProductionRowSchema = z.object({
  월: z.number(),
  일수: nn(),
  계약용량_kW: nn(),
  월간_중간부하시간_전력생산량_kWh: nn(),
  월간_최대부하시간_전력생산량_kWh: nn(),
  월간_연료전지_열생산량_kWh: nn(),
  월간_도시가스사용량_kWh: nn(),
});

const energyProductionOutputSchema = z.object({
  columns: z.array(z.string()),
  데이터: z.array(energyProductionRowSchema),
  합계: energyProductionRowSchema.omit({ 월: true }),
});

const energyRevenueRowSchema = z.object({
  월: z.number(),
  일수: nn(),
  발전_월간총수익_원: nn(),
  열생산_월간총수익_원: nn(),
  도시가스사용요금_원: nn(),
  에너지생산_최종수익_원: nn(),
});

const energyRevenueOutputSchema = z.object({
  columns: z.array(z.string()),
  데이터: z.array(energyRevenueRowSchema),
  합계: energyRevenueRowSchema.omit({ 월: true }),
});

const annualEconomicsRowSchema = z.object({
  연도: z.number(),
  총수익_원: nn(),
  유지보수비용_원: nn(),
  순현금흐름_원: nn(),
  누적순현금흐름_원: nn(),
  할인순현금흐름_원: nn(),
});

const economicsSummaryRowSchema = z.object({
  기간_년: z.number(),
  누적수익_원: nn(),
  누적유지보수비용_원: nn(),
  '초기투자비용(설치비)_원': nn(),
  총비용_원: nn(),
  ROI_초기투자: nn(),
  ROI_총비용: nn(),
  NPV_원: nn(),
  IRR: nn(),
});

const economicsResultSchema = z.object({
  capex: nn(),
  baseAnnualMaintenance: nn(),
  baseAnnualElectricityKWh: nn(),
  lcoe_원per_kWh: nn(),
  annual: z.object({
    columns: z.array(z.string()),
    데이터: z.array(annualEconomicsRowSchema),
  }),
  summary: z.object({
    columns: z.array(z.string()),
    데이터: z.array(economicsSummaryRowSchema),
  }),
});

const settingsSchema = z.object({
  lifetime: z.number(),
  discountRate: z.number(),
  maintenanceMode: z.enum(['fixedCost', 'ratio']),
  maintenanceRatio: z.number(),
  electricityEscalation: z.number(),
  gasEscalation: z.number(),
  maintenanceEscalation: z.number(),
  boilerEfficiency: z.number(),
});

export const reportSnapshotSchema = z.object({
  version: z.literal(1),
  inputs: z.object({
    fuelCell: fuelCellInputSchema,
    operation: operationInputSchema,
  }),
  settings: settingsSchema,
  results: z.object({
    production: energyProductionOutputSchema,
    revenue: energyRevenueOutputSchema,
    economics: economicsResultSchema,
    paybackYears: z.number().nullable(),
  }),
  meta: z.object({
    createdAt: z.string(),
    title: z.string().optional(),
  }),
});

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
