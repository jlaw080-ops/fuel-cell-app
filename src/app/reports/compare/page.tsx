import { Suspense } from 'react';
import { CompareView } from '@/components/reports/CompareView';

export const metadata = { title: '리포트 비교' };

interface PageProps {
  searchParams: Promise<{ ids?: string }>;
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { ids } = await searchParams;
  const idList = (ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <main className="w-full mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">리포트 비교</h1>
      <Suspense fallback={<div className="text-zinc-500">불러오는 중...</div>}>
        <CompareView ids={idList} />
      </Suspense>
    </main>
  );
}
