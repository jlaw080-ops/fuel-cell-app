'use client';

/**
 * Phase 6 — 저장된 리포트 목록.
 *
 * - clientId 기반 조회
 * - 각 행: 리포트 보기 / 앱으로 불러오기 / 삭제
 * - 모바일: 카드 레이아웃 / 데스크탑: 테이블 레이아웃
 */
import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getClientId } from '@/lib/session/clientId';
import {
  listReports,
  deleteReport,
  renameReport,
  setReportPublic,
  type ReportListItem,
} from '@/lib/actions/reports';
import { fmtKW, fmtWon, fmtPct, fmtYears } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ReportsList() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>('');
  const [items, setItems] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 검색/필터/정렬
  const [query, setQuery] = useState('');
  const [publicOnly, setPublicOnly] = useState(false);
  type SortKey = 'createdAt' | 'title' | 'capacity' | 'payback' | 'npv';
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const displayItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    let arr = items;
    if (q) arr = arr.filter((x) => (x.title ?? '').toLowerCase().includes(q));
    if (publicOnly) arr = arr.filter((x) => x.isPublic);
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: ReportListItem, b: ReportListItem) => {
      const nullLast = (v: number | null) => (v == null ? Number.POSITIVE_INFINITY : v);
      switch (sortKey) {
        case 'createdAt':
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case 'title':
          return (a.title ?? '').localeCompare(b.title ?? '', 'ko') * dir;
        case 'capacity':
          return (a.totalCapacity_kW - b.totalCapacity_kW) * dir;
        case 'payback':
          return (nullLast(a.paybackYears) - nullLast(b.paybackYears)) * dir;
        case 'npv':
          return (nullLast(a.npv20_원) - nullLast(b.npv20_원)) * dir;
      }
    };
    return [...arr].sort(cmp);
  }, [items, query, publicOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'title' ? 'asc' : 'desc');
    }
  }
  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

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

  function onTogglePublic(id: string, current: boolean) {
    startTransition(async () => {
      const res = await setReportPublic(id, !current);
      if (res.ok) {
        setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isPublic: res.isPublic } : x)));
      } else {
        alert('공유 설정 실패: ' + res.error);
      }
    });
  }

  async function onCopyLink(id: string) {
    const url = `${window.location.origin}/report?id=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      window.prompt('링크를 복사하세요:', url);
    }
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
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 입력 화면으로
        </Link>
        <span className="flex-1" />
        {selected.size >= 2 && (
          <Button asChild size="xs">
            <Link href={`/reports/compare?ids=${Array.from(selected).join(',')}`}>
              선택한 {selected.size}건 비교
            </Link>
          </Button>
        )}
        <span className="text-xs text-zinc-500">
          {query || publicOnly
            ? `${displayItems.length} / ${items.length}건`
            : `총 ${items.length}건`}
        </span>
      </div>

      {items.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목 검색"
            className="w-full sm:w-64"
          />
          <label className="inline-flex items-center gap-1.5 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={publicOnly}
              onChange={(e) => setPublicOnly(e.target.checked)}
            />
            공유 중만 보기
          </label>
          {(query || publicOnly) && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() => {
                setQuery('');
                setPublicOnly(false);
              }}
            >
              필터 초기화
            </Button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-sm text-zinc-500">
          저장된 리포트가 없습니다. 입력 화면에서 &quot;저장 + 리포트 보기&quot;를 눌러 저장하세요.
        </div>
      ) : displayItems.length === 0 ? (
        <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-sm text-zinc-500">
          조건에 맞는 리포트가 없습니다.
        </div>
      ) : (
        <>
          {/* 모바일 카드 뷰 (md 미만) */}
          <div className="md:hidden space-y-3">
            {displayItems.map((r) => (
              <div
                key={r.id}
                className="border border-zinc-200 rounded-lg bg-white overflow-hidden"
              >
                {/* 카드 헤더 */}
                <div className="px-4 pt-3 pb-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      });
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {editingId === r.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          maxLength={80}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            else if (e.key === 'Escape') cancelEdit();
                          }}
                          className="flex-1 text-xs"
                        />
                        <Button
                          type="button"
                          onClick={commitEdit}
                          disabled={pending}
                          size="xs"
                          className="shrink-0"
                        >
                          저장
                        </Button>
                        <Button
                          type="button"
                          onClick={cancelEdit}
                          variant="outline"
                          size="xs"
                          className="shrink-0"
                        >
                          취소
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        className="text-left text-sm font-medium w-full truncate hover:text-zinc-600"
                        title="클릭하여 이름 변경"
                      >
                        {r.title ?? <span className="text-zinc-400">(제목 없음)</span>}
                      </button>
                    )}
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                  {r.isPublic && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                      공유 중
                    </span>
                  )}
                </div>

                {/* 지표 그리드 */}
                <div className="px-4 py-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-100 bg-zinc-50/60">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">총 용량</span>
                    <span className="font-medium">{fmtKW(r.totalCapacity_kW)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">회수기간</span>
                    <span className="font-medium">
                      {r.paybackYears == null ? '회수 불가' : fmtYears(r.paybackYears)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">20년 NPV</span>
                    <span className="font-medium">{fmtWon(r.npv20_원)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">20년 IRR</span>
                    <span className="font-medium">{fmtPct(r.irr20)}</span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="px-4 py-2.5 border-t border-zinc-100 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="xs">
                    <Link href={`/report?id=${r.id}`}>리포트 보기</Link>
                  </Button>
                  <Button type="button" size="xs" onClick={() => onLoadIntoApp(r.id)}>
                    불러오기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onTogglePublic(r.id, r.isPublic)}
                    disabled={pending}
                    className={
                      r.isPublic ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100' : ''
                    }
                  >
                    {r.isPublic ? '공유 OFF' : '공유 ON'}
                  </Button>
                  {r.isPublic && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onCopyLink(r.id)}
                    >
                      {copiedId === r.id ? '복사됨 ✓' : '링크 복사'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    onClick={() => onDelete(r.id)}
                    disabled={pending}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* 데스크탑 테이블 뷰 (md 이상) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border border-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-2 py-2 w-8"></th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('title')}
                  >
                    제목{sortIndicator('title')}
                  </th>
                  <th
                    className="px-3 py-2 text-left cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('createdAt')}
                  >
                    저장일시{sortIndicator('createdAt')}
                  </th>
                  <th
                    className="px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('capacity')}
                  >
                    총 용량{sortIndicator('capacity')}
                  </th>
                  <th
                    className="px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('payback')}
                  >
                    회수기간{sortIndicator('payback')}
                  </th>
                  <th
                    className="px-3 py-2 text-right cursor-pointer select-none whitespace-nowrap"
                    onClick={() => toggleSort('npv')}
                  >
                    20년 NPV{sortIndicator('npv')}
                  </th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">20년 IRR</th>
                  <th className="px-3 py-2 text-center whitespace-nowrap">액션</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((r) => (
                  <tr key={r.id} className="border-t border-zinc-200">
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={(e) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(r.id);
                            else next.delete(r.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            maxLength={80}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit();
                              else if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 text-xs"
                          />
                          <Button type="button" onClick={commitEdit} disabled={pending} size="xs">
                            저장
                          </Button>
                          <Button type="button" onClick={cancelEdit} variant="outline" size="xs">
                            취소
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(r)}
                            className="text-left hover:bg-zinc-50 px-1 py-0.5 rounded flex-1"
                            title="클릭하여 이름 변경"
                          >
                            {r.title ?? <span className="text-zinc-400">(제목 없음)</span>}
                          </button>
                          {r.isPublic && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                              공유 중
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-600 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {fmtKW(r.totalCapacity_kW)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {r.paybackYears == null ? '회수 불가' : fmtYears(r.paybackYears)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtWon(r.npv20_원)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmtPct(r.irr20)}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1 flex-nowrap">
                        <Button asChild variant="outline" size="xs">
                          <Link href={`/report?id=${r.id}`}>리포트 보기</Link>
                        </Button>
                        <Button type="button" size="xs" onClick={() => onLoadIntoApp(r.id)}>
                          앱으로 불러오기
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onTogglePublic(r.id, r.isPublic)}
                          disabled={pending}
                          className={
                            r.isPublic
                              ? 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100'
                              : ''
                          }
                        >
                          {r.isPublic ? '공유 OFF' : '공유 ON'}
                        </Button>
                        {r.isPublic && (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => onCopyLink(r.id)}
                          >
                            {copiedId === r.id ? '복사됨 ✓' : '링크 복사'}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          onClick={() => onDelete(r.id)}
                          disabled={pending}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
