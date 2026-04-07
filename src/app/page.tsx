import { loadFuelCellLibrary, loadOperationLibrary } from '@/lib/data/loadLibraries';
import { InputScreen } from '@/components/tabs/InputScreen';

export default function Home() {
  const fuelCellLibrary = loadFuelCellLibrary();
  const operationLibrary = loadOperationLibrary();

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">연료전지 경제성 분석 — 입력</h1>
      <InputScreen fuelCellLibrary={fuelCellLibrary} operationLibrary={operationLibrary} />
    </main>
  );
}
