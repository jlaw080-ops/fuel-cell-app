import Link from 'next/link';
import { AuthForm } from '@/components/auth/AuthForm';
import { getCurrentUser } from '@/lib/actions/auth';

export const metadata = { title: '로그인' };

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const user = await getCurrentUser();

  return (
    <main className="w-full mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-bold mb-6">로그인</h1>
      {user ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-700">
            이미 로그인되어 있습니다. <code className="text-xs">{user.email}</code>
          </p>
          <Link href="/" className="text-blue-600 underline text-sm">
            ← 입력 화면으로
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 text-sm text-red-600">로그인에 실패했습니다. 다시 시도하세요.</div>
          )}
          <AuthForm />
          <p className="mt-6 text-xs text-zinc-500">
            이메일로 1회용 로그인 링크를 전송합니다. 비밀번호가 필요하지 않습니다.
          </p>
        </>
      )}
    </main>
  );
}
