import { loadAllLibraries } from '@/lib/data/loadLibraries';
import { InputScreen } from '@/components/tabs/InputScreen';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ reportId?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const libraries = loadAllLibraries();
  const { reportId } = await searchParams;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">연료전지 경제성 분석</h1>
        <Link href="/reports" className="text-sm text-blue-600 underline">
          내 리포트 목록 →
        </Link>
      </div>
      <InputScreen libraries={libraries} reportId={reportId ?? null} />
    </main>
  );
}
