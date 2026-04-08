/**
 * 사용자 입력(Input1, Input2) zod 스키마.
 *
 * Server Action 내부에서 검증한다. Server Function은 직접 POST가 가능하므로
 * 클라이언트 검증과 별개로 서버 검증이 필수다.
 *
 * src/types/inputs.ts와 1:1로 일치해야 한다.
 */
import { z } from 'zod';
import { fuelCellTypeSchema } from './library';
import { operationProfileKeySchema } from './library';

// ============================================================
// Input1: 연료전지 정보
// ============================================================
export const fuelCellInputSetSchema = z.object({
  set_id: z.string().min(1),
  형식: fuelCellTypeSchema.nullable(),
  제조사: z.string().nullable(),
  모델: z.string().nullable(),
  발전용량_kW: z.number().positive().nullable(),
  열생산용량_kW: z.number().nonnegative().nullable(),
  설치수량: z.number().int().positive().nullable(),
  kW당설치단가_override: z.number().positive().nullable().optional(),
  kW당연간유지비용_override: z.number().nonnegative().nullable().optional(),
});

export const fuelCellInputSchema = z.object({
  sets: z.array(fuelCellInputSetSchema),
  총설치용량_kW: z.number().nonnegative().nullable(),
});

// ============================================================
// Input2: 운전시간 정보
// ============================================================
export const operationInputSchema = z
  .object({
    연간운전유형: operationProfileKeySchema.nullable(),
    연간운전일수: z.number().int().nonnegative().nullable(),
    일일_중간부하_운전시간: z.number().min(0).max(24),
    일일_최대부하_운전시간: z.number().min(0).max(24),
  })
  .refine((v) => v.일일_중간부하_운전시간 + v.일일_최대부하_운전시간 <= 24, {
    message: '중간부하 + 최대부하 운전시간 합계가 24시간을 초과합니다.',
  });

// 타입 추론 — src/types/inputs.ts와 일치해야 함
export type FuelCellInputParsed = z.infer<typeof fuelCellInputSchema>;
export type OperationInputParsed = z.infer<typeof operationInputSchema>;
