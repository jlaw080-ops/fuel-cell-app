import { describe, it, expect } from 'vitest';
import { calcEnergyProduction } from '../production';
import type { z } from 'zod';
import type { fuelCellLibrarySchema, operationLibrarySchema } from '@/lib/schemas/library';

type FuelCellLibrary = z.infer<typeof fuelCellLibrarySchema>;
type OperationLibrary = z.infer<typeof operationLibrarySchema>;

const library: FuelCellLibrary = [
  {
    형식: 'PEMFC',
    제조사: '범한퓨얼셀',
    모델명: 'BNH050',
    정격발전용량_kW: 5,
    열생산용량_kW: 8,
    가스소비량_kW: 13.6,
    발전효율: 0.357,
    열회수효율: 0.5242,
    kW당설치단가: 10000000,
    kW당연간유지비용: 2200000,
  },
];

const opLibrary: OperationLibrary = {
  '365일가동': {
    연간가동일: 365,
    월별가동일: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  },
  주말일부가동: { 연간가동일: 300, 월별가동일: [26, 23, 25, 26, 26, 24, 26, 26, 22, 25, 26, 25] },
  평일가동: { 연간가동일: 250, 월별가동일: [22, 19, 21, 22, 22, 20, 22, 21, 18, 21, 21, 21] },
  학기중가동: { 연간가동일: 200, 월별가동일: [0, 14, 23, 22, 21, 22, 15, 3, 22, 21, 22, 15] },
};

describe('calcEnergyProduction', () => {
  it('단일 세트, 24h 가동(중간16+최대8) — 손계산 일치', () => {
    // 1세트 5kW, 가스 13.6kW, 열 8kW, 1월 31일
    const out = calcEnergyProduction({
      fuelCell: {
        sets: [
          {
            set_id: 's1',
            형식: 'PEMFC',
            제조사: '범한퓨얼셀',
            모델: 'BNH050',
            발전용량_kW: 5,
            열생산용량_kW: 8,
            설치수량: 1,
          },
        ],
        총설치용량_kW: 5,
      },
      operation: {
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 16,
        일일_최대부하_운전시간: 8,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });

    const jan = out.데이터[0];
    expect(jan.월).toBe(1);
    expect(jan.일수).toBe(31);
    expect(jan.계약용량_kW).toBe(5);
    expect(jan.월간_중간부하시간_전력생산량_kWh).toBe(5 * 16 * 31); // 2480
    expect(jan.월간_최대부하시간_전력생산량_kWh).toBe(5 * 8 * 31); // 1240
    expect(jan.월간_연료전지_열생산량_kWh).toBe(8 * 24 * 31); // 5952
    expect(jan.월간_도시가스사용량_kWh).toBeCloseTo(13.6 * 24 * 31, 6); // 10118.4

    // 합계: 365일 × 24h
    expect(out.합계.일수).toBe(365);
    expect(out.합계.월간_중간부하시간_전력생산량_kWh).toBe(5 * 16 * 365);
    expect(out.합계.월간_최대부하시간_전력생산량_kWh).toBe(5 * 8 * 365);
    expect(out.합계.월간_연료전지_열생산량_kWh).toBe(8 * 24 * 365);
    expect(out.합계.월간_도시가스사용량_kWh).toBeCloseTo(13.6 * 24 * 365, 4);
  });

  it('복수 세트 수량 합산', () => {
    const out = calcEnergyProduction({
      fuelCell: {
        sets: [
          {
            set_id: 's1',
            형식: 'PEMFC',
            제조사: '범한퓨얼셀',
            모델: 'BNH050',
            발전용량_kW: 5,
            열생산용량_kW: 8,
            설치수량: 3,
          },
        ],
        총설치용량_kW: 15,
      },
      operation: {
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 10,
        일일_최대부하_운전시간: 0,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });
    expect(out.데이터[0].계약용량_kW).toBe(15);
    expect(out.데이터[0].월간_중간부하시간_전력생산량_kWh).toBe(15 * 10 * 31);
    expect(out.데이터[0].월간_최대부하시간_전력생산량_kWh).toBe(0);
    expect(out.데이터[0].월간_도시가스사용량_kWh).toBeCloseTo(13.6 * 3 * 10 * 31, 4);
  });

  it('운전유형 미선택 시 일수/생산량 모두 null', () => {
    const out = calcEnergyProduction({
      fuelCell: {
        sets: [
          {
            set_id: 's1',
            형식: 'PEMFC',
            제조사: '범한퓨얼셀',
            모델: 'BNH050',
            발전용량_kW: 5,
            열생산용량_kW: 8,
            설치수량: 1,
          },
        ],
        총설치용량_kW: 5,
      },
      operation: {
        연간운전유형: null,
        연간운전일수: null,
        일일_중간부하_운전시간: 16,
        일일_최대부하_운전시간: 8,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });
    expect(out.데이터[0].일수).toBeNull();
    expect(out.데이터[0].월간_중간부하시간_전력생산량_kWh).toBeNull();
    expect(out.데이터[0].월간_도시가스사용량_kWh).toBeNull();
    // 계약용량 자체는 입력만으로 결정
    expect(out.데이터[0].계약용량_kW).toBe(5);
  });

  it('라이브러리에 모델 없음 → 가스사용량 null, 발전·열은 정상', () => {
    const out = calcEnergyProduction({
      fuelCell: {
        sets: [
          {
            set_id: 's1',
            형식: 'PEMFC',
            제조사: '미상',
            모델: '존재하지않는모델',
            발전용량_kW: 5,
            열생산용량_kW: 8,
            설치수량: 1,
          },
        ],
        총설치용량_kW: 5,
      },
      operation: {
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 16,
        일일_최대부하_운전시간: 8,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });
    expect(out.데이터[0].월간_중간부하시간_전력생산량_kWh).toBe(5 * 16 * 31);
    expect(out.데이터[0].월간_도시가스사용량_kWh).toBeNull();
    expect(out.합계.월간_도시가스사용량_kWh).toBeNull();
  });

  it('빈 세트 → 모든 값 null', () => {
    const out = calcEnergyProduction({
      fuelCell: { sets: [], 총설치용량_kW: 0 },
      operation: {
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 16,
        일일_최대부하_운전시간: 8,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });
    expect(out.데이터[0].계약용량_kW).toBeNull();
    expect(out.데이터[0].월간_중간부하시간_전력생산량_kWh).toBeNull();
    expect(out.합계.월간_중간부하시간_전력생산량_kWh).toBeNull();
  });

  it('학기중가동 1월=0일 → 1월 생산량 0', () => {
    const out = calcEnergyProduction({
      fuelCell: {
        sets: [
          {
            set_id: 's1',
            형식: 'PEMFC',
            제조사: '범한퓨얼셀',
            모델: 'BNH050',
            발전용량_kW: 5,
            열생산용량_kW: 8,
            설치수량: 1,
          },
        ],
        총설치용량_kW: 5,
      },
      operation: {
        연간운전유형: '학기중가동',
        연간운전일수: 200,
        일일_중간부하_운전시간: 16,
        일일_최대부하_운전시간: 8,
      },
      fuelCellLibrary: library,
      operationLibrary: opLibrary,
    });
    expect(out.데이터[0].일수).toBe(0);
    expect(out.데이터[0].월간_중간부하시간_전력생산량_kWh).toBe(0);
    expect(out.데이터[1].일수).toBe(14); // 2월
  });
});
