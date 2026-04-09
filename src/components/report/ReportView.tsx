'use client';

/**
 * Phase 5b — 리포트 뷰어.
 *
 * 동작:
 *   1. ?id= 있으면 Supabase에서 로드
 *   2. 없으면 localStorage draft 로드
 *   3. 없으면 "결과 페이지에서 먼저 리포트를 생성하세요" 안내
 *
 * AI 검토는 id가 있고 ai_review가 비어 있을 때만 백그라운드 생성.
 */
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import type { ReportSnapshot } from '@/lib/schemas/report';
import { loadReportDraftLocal } from '@/lib/report/buildSnapshot';
import { loadReport, saveAiReview, setReportPublic } from '@/lib/actions/reports';
import { generateAiReview } from '@/lib/gemini/review';
import { ReportDocument } from './ReportDocument';
import '@/app/report/report.css';

interface Props {
  reportId: string | null;
}

export function ReportView({ reportId }: Props) {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [aiSkipped, setAiSkipped] = useState(false);
  const [aiLoading, startAi] = useTransition();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [sharePending, startShare] = useTransition();
  const [copied, setCopied] = useState(false);

  // 1) 데이터 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (reportId) {
        const res = await loadReport(reportId);
        if (cancelled) return;
        if (!res.ok) {
          setErr(res.error);
          setLoading(false);
          return;
        }
        setSnapshot(res.data.snapshot);
        setAiReview(res.data.aiReview);
        setIsPublic(res.data.isPublic);
        setIsOwner(res.data.isOwner);
      } else {
        const draft = loadReportDraftLocal();
        if (cancelled) return;
        if (draft) setSnapshot(draft);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  // 1-b) 인쇄 시 recharts 재측정 — 화면 폭 기준으로 고정된 SVG 를
  // 인쇄 페이지 폭에 맞추기 위해 beforeprint 에서 resize 이벤트 dispatch.
  useEffect(() => {
    const handler = () => window.dispatchEvent(new Event('resize'));
    window.addEventListener('beforeprint', handler);
    window.addEventListener('afterprint', handler);
    return () => {
      window.removeEventListener('beforeprint', handler);
      window.removeEventListener('afterprint', handler);
    };
  }, []);

  // 2) AI 검토 자동 생성 (id 있고, 검토 없을 때만)
  useEffect(() => {
    if (!snapshot || aiReview || aiSkipped) return;
    if (!reportId) return;
    startAi(async () => {
      const res = await generateAiReview(snapshot);
      if (res.ok) {
        setAiReview(res.review);
        await saveAiReview(reportId, res.review);
      } else {
        setAiSkipped(true);
      }
    });
  }, [snapshot, aiReview, aiSkipped, reportId]);

  function onRegenerateAi() {
    if (!snapshot || !reportId) return;
    if (!confirm('현재 AI 검토를 새로 생성하시겠습니까? 기존 내용은 덮어씌워집니다.')) return;
    setAiSkipped(false);
    startAi(async () => {
      const res = await generateAiReview(snapshot);
      if (res.ok) {
        setAiReview(res.review);
        await saveAiReview(reportId, res.review);
      } else {
        alert('AI 검토 생성에 실패했습니다.');
        setAiSkipped(true);
      }
    });
  }

  if (loading) return <div className="p-8 text-zinc-500">불러오는 중...</div>;
  if (err) return <div className="p-8 text-red-600">오류: {err}</div>;
  if (!snapshot) {
    return (
      <div className="p-8 space-y-4">
        <p className="text-zinc-600">표시할 리포트 데이터가 없습니다.</p>
        <Link href="/" className="text-blue-600 underline">
          입력 화면으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="no-print sticky top-0 bg-white border-b border-zinc-200 px-6 py-3 flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 입력으로 돌아가기
        </Link>
        <Link href="/reports" className="text-sm text-blue-600 underline">
          내 리포트 목록
        </Link>
        {reportId && (
          <Link href={`/?reportId=${reportId}`} className="text-sm text-blue-600 underline">
            앱으로 불러오기
          </Link>
        )}
        <span className="flex-1" />
        {reportId && isOwner && (
          <button
            type="button"
            disabled={aiLoading || !snapshot}
            onClick={onRegenerateAi}
            className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white text-zinc-700 disabled:opacity-50"
          >
            {aiLoading ? 'AI 생성 중...' : 'AI 검토 재생성'}
          </button>
        )}
        {reportId && isOwner && (
          <>
            <button
              type="button"
              disabled={sharePending}
              onClick={() =>
                startShare(async () => {
                  const next = !isPublic;
                  const res = await setReportPublic(reportId, next);
                  if (res.ok) setIsPublic(res.isPublic);
                  else alert('공유 설정 실패: ' + res.error);
                })
              }
              className={
                'px-3 py-2 rounded text-sm border ' +
                (isPublic
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-zinc-300 text-zinc-700')
              }
            >
              {isPublic ? '공유 ON' : '공유 OFF'}
            </button>
            {isPublic && (
              <button
                type="button"
                onClick={async () => {
                  const url = `${window.location.origin}/report?id=${reportId}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    window.prompt('링크를 복사하세요:', url);
                  }
                }}
                className="px-3 py-2 rounded text-sm border border-zinc-300 bg-white text-zinc-700"
              >
                {copied ? '복사됨 ✓' : '링크 복사'}
              </button>
            )}
          </>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-zinc-900 text-white rounded text-sm"
        >
          PDF 저장 / 인쇄
        </button>
      </div>

      <ReportDocument
        snapshot={snapshot}
        aiReview={aiReview}
        aiLoading={aiLoading}
        aiSkipped={aiSkipped}
      />
    </div>
  );
}
