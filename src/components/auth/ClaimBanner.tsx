'use client';

/**
 * Phase 6e-2 — 로그인 직후 1회 anon → user 리포트 흡수 + 결과 배너.
 * 사용자당 1회만 실행되도록 localStorage 플래그로 중복 방지.
 */
import { useEffect, useState } from 'react';
import { getClientId } from '@/lib/session/clientId';
import { claimAnonReports } from '@/lib/actions/reports';

interface Props {
  userId: string;
}

const flagKey = (uid: string) => `fc-app-claimed:${uid}`;

export function ClaimBanner({ userId }: Props) {
  const [claimed, setClaimed] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(flagKey(userId))) return;
    const clientId = getClientId();
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const res = await claimAnonReports(clientId);
      if (cancelled) return;
      window.localStorage.setItem(flagKey(userId), '1');
      if (res.ok && res.claimed > 0) setClaimed(res.claimed);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (dismissed || !claimed) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
      <span>기존 {claimed}건의 임시 리포트를 계정으로 이전했습니다.</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="ml-4 text-blue-600 underline"
      >
        닫기
      </button>
    </div>
  );
}
