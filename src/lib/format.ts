/**
 * 숫자 포맷터 — 한국어 로케일 기준.
 *
 * 모든 포맷터는 null/undefined/NaN 입력 시 '-'를 반환한다.
 */
const nf0 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const nfWon = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
});
const nfPct = new Intl.NumberFormat('ko-KR', {
  style: 'percent',
  maximumFractionDigits: 2,
});

function isFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function fmtInt(n: number | null | undefined): string {
  return isFinite(n) ? nf0.format(n) : '-';
}

export function fmtNum(n: number | null | undefined, digits = 0): string {
  if (!isFinite(n)) return '-';
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function fmtKWh(n: number | null | undefined): string {
  return isFinite(n) ? `${nf0.format(n)} kWh` : '-';
}

export function fmtKW(n: number | null | undefined): string {
  return isFinite(n) ? `${nf2.format(n)} kW` : '-';
}

export function fmtWon(n: number | null | undefined): string {
  return isFinite(n) ? nfWon.format(n) : '-';
}

export function fmtWonPerKWh(n: number | null | undefined): string {
  return isFinite(n) ? `${nf0.format(n)} 원/kWh` : '-';
}

export function fmtPct(n: number | null | undefined): string {
  return isFinite(n) ? nfPct.format(n) : '-';
}

export function fmtYears(n: number | null | undefined): string {
  return isFinite(n) ? `${nf2.format(n)} 년` : '-';
}
