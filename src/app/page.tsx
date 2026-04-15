import { loadAllLibraries } from '@/lib/data/loadLibraries';
import { InputScreen } from '@/components/tabs/InputScreen';
import Link from 'next/link';
import { getCurrentUser, signOut } from '@/lib/actions/auth';
import { ClaimBanner } from '@/components/auth/ClaimBanner';

interface PageProps {
  searchParams: Promise<{ reportId?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const libraries = await loadAllLibraries();
  const { reportId } = await searchParams;
  const user = await getCurrentUser();

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">연료전지 경제성 분석</h1>
        <div className="flex items-center gap-3">
          <Link href="/reports" className="text-sm text-blue-600 underline">
            내 리포트 목록 →
          </Link>
          {user ? (
            <form action={signOut}>
              <span className="text-xs text-zinc-500 mr-2">{user.email}</span>
              <button type="submit" className="text-sm text-zinc-600 underline">
                로그아웃
              </button>
            </form>
          ) : (
            <Link href="/auth" className="text-sm text-blue-600 underline">
              로그인
            </Link>
          )}
        </div>
      </div>
      {user ? <ClaimBanner userId={user.id} /> : null}
      <InputScreen libraries={libraries} reportId={reportId ?? null} />
    </main>
  );
}
