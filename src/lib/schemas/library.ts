/**
 * 라이브러리 JSON zod 스키마.
 *
 * src/data/*.json 파일을 런타임에 검증하기 위한 스키마.
 * src/types/*.ts의 타입 정의와 1:1로 일치해야 한다.
 *
 * JSON 키는 한국어이며, CLADE.md 규칙에 따라 변경 금지.
 */
import { z } from 'zod';

// ============================================================
// 연료전지제품라이브러리.json
// ============================================================
export const fuelCellTypeSchema = z.enum(['PEMFC', 'SOFC', 'PAFC']);

export const fuelCellProductSchema = z.object({
  형식: fuelCellTypeSchema,
  제조사: z.string(),
  모델명: z.string().nullable(),
  정격발전용량_kW: z.number(),
  열생산용량_kW: z.number().nullable(),
  가스소비량_kW: z.number().nullable(),
  발전효율: z.number(),
  열회수효율: z.number().nullable(),
  kW당설치단가: z.number().nullable(),
  kW당연간유지비용: z.number().nullable(),
});

export const fuelCellLibrarySchema = z.array(fuelCellProductSchema);

// ============================================================
// 월별가동일라이브러리.json
// ============================================================
export const operationProfileKeySchema = z.enum([
  '365일가동',
  '주말일부가동',
  '평일가동',
  '학기중가동',
]);

export const operationProfileSchema = z.object({
  연간가동일: z.number().int().nonnegative(),
  월별가동일: z.array(z.number().int().nonnegative()).length(12),
});

export const operationLibrarySchema = z.record(operationProfileKeySchema, operationProfileSchema);

// ============================================================
// 전기요금라이브러리.json
// ============================================================
export const electricityTariffRowSchema = z.object({
  월: z.number().int().min(1).max(12),
  경부하: z.number(),
  중간부하: z.number(),
  최대부하: z.number(),
});

export const electricityTariffLibrarySchema = z.object({
  요금제: z.string(),
  기본요금_원per_kW: z.number(),
  단위: z.string(),
  데이터: z.array(electricityTariffRowSchema).length(12),
});

// ============================================================
// 가스요금라이브러리.json
// ============================================================
export const gasTariffEntrySchema = z.object({
  구분: z.string(),
  단가_원per_kW: z.number(),
});

export const gasTariffLibrarySchema = z.array(gasTariffEntrySchema);
