'use server';

import { createSupabaseServerClient } from '@/lib/supabase/serverWithAuth';
import { redirect } from 'next/navigation';

export async function signInWithMagicLink(
  formData: FormData,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const email = String(formData.get('email') ?? '').trim();
  if (!email || !email.includes('@')) {
    return { ok: false, error: '올바른 이메일을 입력하세요.' };
  }

  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: origin ? `${origin}/auth/callback` : undefined,
      shouldCreateUser: true,
    },
  });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    message: `${email} 으로 로그인 링크를 전송했습니다. 이메일을 확인하세요.`,
  };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
