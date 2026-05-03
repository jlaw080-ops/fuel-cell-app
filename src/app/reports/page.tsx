import { Suspense } from 'react';
import { ReportsList } from '@/components/reports/ReportsList';

export const metadata = {
  title: '내 리포트 목록',
};

export default function ReportsPage() {
  return (
    <main className="w-full mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold mb-6">내 리포트 목록</h1>
      <Suspense fallback={<div className="text-zinc-500">불러오는 중...</div>}>
        <ReportsList />
      </Suspense>
    </main>
  );
}
