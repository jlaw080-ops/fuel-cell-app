import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FuelCellSetRow, type FuelCellSetState } from '../FuelCellSetRow';
import type { FuelCellLibrary } from '@/types/fuelCell';

const library: FuelCellLibrary = [
  {
    형식: 'PEMFC',
    제조사: 'A',
    모델명: 'A-100',
    정격발전용량_kW: 10,
    열생산용량_kW: 5,
    가스소비량_kW: 20,
    발전효율: 0.4,
    열회수효율: 0.5,
    kW당설치단가: null,
    kW당연간유지비용: null,
  },
  {
    형식: 'PEMFC',
    제조사: 'B',
    모델명: 'B-200',
    정격발전용량_kW: 20,
    열생산용량_kW: 10,
    가스소비량_kW: 40,
    발전효율: 0.4,
    열회수효율: 0.5,
    kW당설치단가: null,
    kW당연간유지비용: null,
  },
  {
    형식: 'SOFC',
    제조사: 'C',
    모델명: 'C-300',
    정격발전용량_kW: 30,
    열생산용량_kW: 15,
    가스소비량_kW: 60,
    발전효율: 0.55,
    열회수효율: 0.3,
    kW당설치단가: null,
    kW당연간유지비용: null,
  },
];

function emptyValue(): FuelCellSetState {
  return {
    set_id: 'row-1',
    형식: null,
    제조사: null,
    모델: null,
    발전용량_kW: null,
    열생산용량_kW: null,
    설치수량: null,
  };
}

describe('FuelCellSetRow', () => {
  it('형식 선택 시 onChange가 형식만 set하고 하위는 리셋', () => {
    const onChange = vi.fn();
    render(
      <FuelCellSetRow
        value={emptyValue()}
        library={library}
        onChange={onChange}
        onRemove={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText('형식'), { target: { value: 'PEMFC' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ 형식: 'PEMFC', 제조사: null, 모델: null, 발전용량_kW: null }),
    );
  });

  it('형식 미선택 시 제조사/모델 드롭다운 비활성', () => {
    render(
      <FuelCellSetRow
        value={emptyValue()}
        library={library}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByLabelText('제조사')).toBeDisabled();
    expect(screen.getByLabelText('모델')).toBeDisabled();
  });

  it('형식 선택 후 제조사 후보가 라이브러리에서 필터링됨', () => {
    const value: FuelCellSetState = { ...emptyValue(), 형식: 'PEMFC' };
    render(
      <FuelCellSetRow value={value} library={library} onChange={() => {}} onRemove={() => {}} />,
    );
    const mfr = screen.getByLabelText('제조사') as HTMLSelectElement;
    expect(mfr).not.toBeDisabled();
    const opts = Array.from(mfr.querySelectorAll('option')).map((o) => o.value);
    expect(opts).toEqual(['', 'A', 'B']); // SOFC의 C는 제외
  });

  it('모델 선택 시 발전용량/열생산용량 자동 채움', () => {
    const onChange = vi.fn();
    const value: FuelCellSetState = { ...emptyValue(), 형식: 'PEMFC', 제조사: 'B' };
    render(
      <FuelCellSetRow value={value} library={library} onChange={onChange} onRemove={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('모델'), { target: { value: 'B-200' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ 모델: 'B-200', 발전용량_kW: 20, 열생산용량_kW: 10 }),
    );
  });

  it('삭제 버튼 클릭 시 onRemove 호출', () => {
    const onRemove = vi.fn();
    render(
      <FuelCellSetRow
        value={emptyValue()}
        library={library}
        onChange={() => {}}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByText('삭제'));
    expect(onRemove).toHaveBeenCalled();
  });
});
