import { describe, it, expect } from 'vitest';
import { fuelCellInputSchema, operationInputSchema } from '../inputs';

describe('fuelCellInputSchema', () => {
  it('accepts valid empty sets', () => {
    expect(() => fuelCellInputSchema.parse({ sets: [], 총설치용량_kW: 0 })).not.toThrow();
  });

  it('accepts valid set with all fields', () => {
    const data = {
      sets: [
        {
          set_id: 'a',
          형식: 'PEMFC' as const,
          제조사: '범한퓨얼셀',
          모델: 'BNH050',
          발전용량_kW: 5,
          열생산용량_kW: 8,
          설치수량: 2,
        },
      ],
      총설치용량_kW: 10,
    };
    expect(() => fuelCellInputSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid 형식', () => {
    expect(() =>
      fuelCellInputSchema.parse({
        sets: [
          {
            set_id: 'a',
            형식: 'INVALID',
            제조사: null,
            모델: null,
            발전용량_kW: null,
            열생산용량_kW: null,
            설치수량: null,
          },
        ],
        총설치용량_kW: null,
      }),
    ).toThrow();
  });
});

describe('operationInputSchema', () => {
  it('accepts valid input', () => {
    expect(() =>
      operationInputSchema.parse({
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 8,
        일일_최대부하_운전시간: 4,
      }),
    ).not.toThrow();
  });

  it('rejects total operating time exceeding 24h', () => {
    expect(() =>
      operationInputSchema.parse({
        연간운전유형: '365일가동',
        연간운전일수: 365,
        일일_중간부하_운전시간: 14,
        일일_최대부하_운전시간: 12,
      }),
    ).toThrow();
  });

  it('rejects negative time', () => {
    expect(() =>
      operationInputSchema.parse({
        연간운전유형: null,
        연간운전일수: null,
        일일_중간부하_운전시간: -1,
        일일_최대부하_운전시간: 0,
      }),
    ).toThrow();
  });
});
