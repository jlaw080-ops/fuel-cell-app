'use client';

import { useState, useTransition } from 'react';
import { signInWithMagicLink } from '@/lib/actions/auth';

export function AuthForm() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function onSubmit(formData: FormData) {
    setMsg(null);
    start(async () => {
      const res = await signInWithMagicLink(formData);
      setMsg(res.ok ? { kind: 'ok', text: res.message } : { kind: 'err', text: res.error });
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <label htmlFor="email" className="block text-sm text-zinc-700">
        이메일
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="w-full px-3 py-2 border border-zinc-300 rounded text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="w-full px-3 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50"
      >
        {pending ? '전송 중...' : '로그인 링크 받기'}
      </button>
      {msg && (
        <div className={msg.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
          {msg.text}
        </div>
      )}
    </form>
  );
}
