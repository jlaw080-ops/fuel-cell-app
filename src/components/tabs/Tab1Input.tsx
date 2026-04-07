/**
 * 탭1 — 입력 화면 (Server Component).
 *
 * 라이브러리를 서버에서 로드하여 클라이언트 컴포넌트에 props로 전달한다.
 * 저장 폼/액션 통합은 작업 2-9(페이지 통합)에서 마무리한다.
 */
import { loadFuelCellLibrary } from '@/lib/data/loadLibraries';
import { FuelCellSetList } from '@/components/inputs/FuelCellSetList';

export function Tab1Input() {
  const fuelCellLibrary = loadFuelCellLibrary();

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">연료전지 정보 입력</h2>
        <p className="text-sm text-zinc-600">형식 → 제조사 → 모델 순으로 선택하세요.</p>
      </header>

      <FuelCellSetList library={fuelCellLibrary} />
    </section>
  );
}
