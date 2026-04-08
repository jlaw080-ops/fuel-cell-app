import { Suspense } from 'react';
import { ReportView } from '@/components/report/ReportView';

export const metadata = {
  title: '연료전지 경제성 분석 리포트',
};

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function ReportPage({ searchParams }: PageProps) {
  const { id } = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">리포트 준비 중...</div>}>
      <ReportView reportId={id ?? null} />
    </Suspense>
  );
}
