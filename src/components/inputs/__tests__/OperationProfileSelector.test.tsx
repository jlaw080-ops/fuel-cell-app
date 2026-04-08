import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OperationProfileSelector } from '../OperationProfileSelector';
import type { OperationLibrary } from '@/types/operation';

const library: OperationLibrary = {
  '365일가동': { 연간가동일: 365, 월별가동일: Array(12).fill(30) },
  주말일부가동: { 연간가동일: 300, 월별가동일: Array(12).fill(25) },
  평일가동: { 연간가동일: 250, 월별가동일: Array(12).fill(21) },
  학기중가동: { 연간가동일: 200, 월별가동일: Array(12).fill(17) },
};

describe('OperationProfileSelector', () => {
  it('기본값은 16h / 8h (합계 24h, valid)', () => {
    const onChange = vi.fn();
    render(<OperationProfileSelector library={library} onChange={onChange} />);
    expect(screen.getByLabelText('일일 중간부하 운전시간')).toHaveValue(16);
    expect(screen.getByLabelText('일일 최대부하 운전시간')).toHaveValue(8);
    expect(screen.getByText(/합계:/)).toHaveTextContent('24');
  });

  it('운전유형 선택 전에는 valid=false', () => {
    const onChange = vi.fn();
    render(<OperationProfileSelector library={library} onChange={onChange} />);
    // 마지막 호출의 valid 인자가 false
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(false);
  });

  it('운전유형 선택 시 연간가동일 표시 + valid=true', () => {
    const onChange = vi.fn();
    render(<OperationProfileSelector library={library} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('연간 운전유형'), {
      target: { value: '365일가동' },
    });
    expect(screen.getByText(/연간 365일 가동/)).toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[0]).toMatchObject({ 연간운전유형: '365일가동', 연간운전일수: 365 });
    expect(lastCall?.[1]).toBe(true);
  });

  it('합계 24h 초과 시 에러 메시지 + valid=false', () => {
    const onChange = vi.fn();
    render(<OperationProfileSelector library={library} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('연간 운전유형'), {
      target: { value: '365일가동' },
    });
    fireEvent.change(screen.getByLabelText('일일 중간부하 운전시간'), {
      target: { value: '20' },
    });
    // 20 + 8 = 28 > 24
    expect(screen.getByText(/24시간을 초과합니다/)).toBeInTheDocument();
    const lastCall = onChange.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(false);
  });

  it('월별 가동일 12칸이 read-only로 표시됨', () => {
    render(<OperationProfileSelector library={library} />);
    fireEvent.change(screen.getByLabelText('연간 운전유형'), {
      target: { value: '평일가동' },
    });
    expect(screen.getByText('월별 가동일 (read-only)')).toBeInTheDocument();
    // 12개 셀 모두 21
    const cells = screen.getAllByText('21');
    expect(cells.length).toBe(12);
  });
});
