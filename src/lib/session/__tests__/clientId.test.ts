import { describe, it, expect, beforeEach, vi } from 'vitest';

// localStorage 모킹 (jsdom 의존 회피)
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  vi.stubGlobal('window', { localStorage });
});

// 모킹 후 import (모듈 캐시 회피 위해 동적 import)
async function loadModule() {
  return await import('../clientId');
}

describe('clientId', () => {
  it('generates a UUID on first call and persists it', async () => {
    const { getClientId } = await loadModule();
    const id1 = getClientId();
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const id2 = getClientId();
    expect(id2).toBe(id1);
  });

  it('returns a new UUID after reset', async () => {
    const { getClientId, resetClientId } = await loadModule();
    const id1 = getClientId();
    resetClientId();
    const id2 = getClientId();
    expect(id2).not.toBe(id1);
  });
});
