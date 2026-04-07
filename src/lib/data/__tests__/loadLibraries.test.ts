import { describe, it, expect } from 'vitest';
import {
  loadFuelCellLibrary,
  loadOperationLibrary,
  loadElectricityTariff,
  loadGasTariff,
  loadAllLibraries,
} from '../loadLibraries';

describe('library loaders', () => {
  it('fuel cell library passes schema and contains expected types', () => {
    const lib = loadFuelCellLibrary();
    expect(lib.length).toBeGreaterThan(0);
    const types = new Set(lib.map((p) => p.형식));
    expect(types.has('PEMFC')).toBe(true);
    expect(types.has('SOFC')).toBe(true);
  });

  it('operation library has all 4 profile keys with 12 monthly entries', () => {
    const lib = loadOperationLibrary();
    const keys = ['365일가동', '주말일부가동', '평일가동', '학기중가동'] as const;
    for (const k of keys) {
      expect(lib[k]).toBeDefined();
      expect(lib[k]?.월별가동일).toHaveLength(12);
    }
    expect(lib['365일가동']?.연간가동일).toBe(365);
  });

  it('electricity tariff has 12 monthly rows with 1..12 months', () => {
    const lib = loadElectricityTariff();
    expect(lib.데이터).toHaveLength(12);
    const months = lib.데이터.map((r) => r.월).sort((a, b) => a - b);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(lib.기본요금_원per_kW).toBeGreaterThan(0);
  });

  it('gas tariff library is non-empty array', () => {
    const lib = loadGasTariff();
    expect(lib.length).toBeGreaterThan(0);
    expect(lib[0]?.단가_원per_kW).toBeGreaterThan(0);
  });

  it('loadAllLibraries returns all 4 libraries', () => {
    const all = loadAllLibraries();
    expect(all.fuelCell).toBeDefined();
    expect(all.operation).toBeDefined();
    expect(all.electricity).toBeDefined();
    expect(all.gas).toBeDefined();
  });
});
