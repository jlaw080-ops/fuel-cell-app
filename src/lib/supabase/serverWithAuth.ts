import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Phase 6e-1 — 인증 컨텍스트가 있는 Supabase 서버 클라이언트.
 * Server Actions / Route Handlers 에서 사용. 쿠키 기반 세션.
 *
 * 기존 supabase/server.ts(supabaseServer)는 익명 키만 가지므로 RLS가
 * anon 정책으로 평가됨. 인증 사용자가 본인 row를 다루려면 본 클라이언트를 사용해야 함.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component 에서 호출 시 무시 (middleware 가 갱신 책임).
          }
        },
      },
    },
  );
}
