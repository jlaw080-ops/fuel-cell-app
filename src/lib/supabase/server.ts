/**
 * 서버측(Server Action / Route Handler / Server Component)에서 사용하는
 * Supabase 클라이언트.
 *
 * 현재는 publishable(anon) key를 사용하므로 src/lib/supabase/client.ts와
 * 동일하지만, 추후 service_role key 도입 시 본 파일에서 분기한다.
 *
 * 주의: 본 파일은 클라이언트 컴포넌트에서 import 금지.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY',
  );
}

export const supabaseServer = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
