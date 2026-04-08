import { loadAllLibraries } from '@/lib/data/loadLibraries';
import { InputScreen } from '@/components/tabs/InputScreen';

export default function Home() {
  const libraries = loadAllLibraries();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">연료전지 경제성 분석</h1>
      <InputScreen libraries={libraries} />
    </main>
  );
}
