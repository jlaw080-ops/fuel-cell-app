'use client';

/**
 * Phase 6 — 저장된 리포트 목록.
 *
 * - clientId 기반 조회
 * - 각 행: 리포트 보기 / 앱으로 불러오기 / 삭제
 */
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getClientId } from '@/lib/session/clientId';
import {
  listReports,
  deleteReport,
  renameReport,
  type ReportListItem,
} from '@/lib/actions/reports';
import { fmtKW, fmtWon, fmtPct, fmtYears } from '@/lib/format';

export function ReportsList() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>('');
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    const id = getClientId() ?? '';
    if (!id) {
      Promise.resolve().then(() => {
        setClientId('');
        setLoading(false);
      });
      return;
    }
    (async () => {
      const res = await listReports(id);
      setClientId(id);
      if (res.ok) setItems(res.data);
      else setErr(res.error);
      setLoading(false);
    })();
  }, []);

  function onDelete(id: string) {
    if (!clientId) return;
    if (!confirm('이 리포트를 삭제하시겠습니까?')) return;
    startTransition(async () => {
      const res = await deleteReport(id, clientId);
      if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
      else alert('삭제 실패: ' + res.error);
    });
  }

  function onLoadIntoApp(id: string) {
    router.push(`/?reportId=${id}`);
  }

  function startEdit(item: ReportListItem) {
    setEditingId(item.id);
    setEditingTitle(item.title ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingTitle('');
  }

  function commitEdit() {
    if (!editingId || !clientId) return;
    const targetId = editingId;
    const newTitle = editingTitle;
    startTransition(async () => {
      const res = await renameReport(targetId, clientId, newTitle);
      if (res.ok) {
        setItems((prev) => prev.map((x) => (x.id === targetId ? { ...x, title: res.title } : x)));
        setEditingId(null);
        setEditingTitle('');
      } else {
        alert('이름 변경 실패: ' + res.error);
      }
    });
  }

  if (loading) return <div className="text-zinc-500">불러오는 중...</div>;
  if (err) return <div className="text-red-600">오류: {err}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 입력 화면으로
        </Link>
        <span className="flex-1" />
        <span className="text-xs text-zinc-500">총 {items.length}건</span>
      </div>

      {items.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-sm text-zinc-500">
          저장된 리포트가 없습니다. 입력 화면에서 &quot;저장 + 리포트 보기&quot;를 눌러 저장하세요.
        </div>
      ) : (
        <table className="w-full text-sm border border-zinc-200">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-3 py-2 text-left">제목</th>
              <th className="px-3 py-2 text-left">저장일시</th>
              <th className="px-3 py-2 text-right">총 용량</th>
              <th className="px-3 py-2 text-right">회수기간</th>
              <th className="px-3 py-2 text-right">20년 NPV</th>
              <th className="px-3 py-2 text-right">20년 IRR</th>
              <th className="px-3 py-2 text-center">액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t border-zinc-200">
                <td className="px-3 py-2">
                  {editingId === r.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        maxLength={80}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          else if (e.key === 'Escape') cancelEdit();
                        }}
                        className="flex-1 px-2 py-1 border border-zinc-300 rounded text-xs"
                      />
                      <button
                        type="button"
                        onClick={commitEdit}
                        disabled={pending}
                        className="px-2 py-1 bg-zinc-900 text-white rounded text-xs disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-2 py-1 border border-zinc-300 rounded text-xs"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="text-left hover:bg-zinc-50 px-1 py-0.5 rounded w-full"
                      title="클릭하여 이름 변경"
                    >
                      {r.title ?? <span className="text-zinc-400">(제목 없음)</span>}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-600">
                  {new Date(r.createdAt).toLocaleString('ko-KR')}
                </td>
                <td className="px-3 py-2 text-right">{fmtKW(r.totalCapacity_kW)}</td>
                <td className="px-3 py-2 text-right">
                  {r.paybackYears == null ? '회수 불가' : fmtYears(r.paybackYears)}
                </td>
                <td className="px-3 py-2 text-right">{fmtWon(r.npv20_원)}</td>
                <td className="px-3 py-2 text-right">{fmtPct(r.irr20)}</td>
                <td className="px-3 py-2 text-center space-x-2 whitespace-nowrap">
                  <Link
                    href={`/report?id=${r.id}`}
                    className="px-2 py-1 border border-zinc-300 rounded text-xs bg-white hover:bg-zinc-50"
                  >
                    리포트 보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => onLoadIntoApp(r.id)}
                    className="px-2 py-1 bg-zinc-900 text-white rounded text-xs"
                  >
                    앱으로 불러오기
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    disabled={pending}
                    className="px-2 py-1 border border-red-300 text-red-600 rounded text-xs hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
