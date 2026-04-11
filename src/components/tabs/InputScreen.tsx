'use client';

/**
 * 입력 화면 통합 클라이언트 컴포넌트.
 *
 * - 마운트 시 clientId 확보 + 최신 입력 복원
 * - 두 입력 컴포넌트(FuelCellSetList, OperationProfileSelector) 상태 보관
 * - 저장 버튼 클릭 시 Server Action 호출 (useTransition으로 pending 표시)
 * - 결과는 inline 메시지로 표시
 *
 * 라이브러리는 Server Component(page.tsx)에서 props로 주입.
 */
import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AllLibraries } from '@/lib/data/loadLibraries';
import { getClientId } from '@/lib/session/clientId';
import { saveFuelCellInput, saveOperationInput, loadLatestInputs } from '@/lib/actions/inputs';
import { loadReport } from '@/lib/actions/reports';
import type { EconomicsSettings } from '@/components/results/EconomicsSettingsPanel';
import { Button } from '@/components/ui/button';
import { FuelCellSetList } from '@/components/inputs/FuelCellSetList';
import type { FuelCellSetState } from '@/components/inputs/FuelCellSetRow';
import {
  OperationProfileSelector,
  type OperationInputState,
} from '@/components/inputs/OperationProfileSelector';
import { ResultsSection } from '@/components/results/ResultsSection';

interface Props {
  libraries: AllLibraries;
  reportId?: string | null;
}

type Msg = { kind: 'ok' | 'err'; text: string } | null;

export function InputScreen({ libraries, reportId = null }: Props) {
  const { fuelCell: fuelCellLibrary, operation: operationLibrary } = libraries;
  const router = useRouter();
  const [clientId, setClientId] = useState<string>('');
  const [resetKey, setResetKey] = useState(0);
  const [skipRestore, setSkipRestore] = useState(false);
  const [initialFuelCell, setInitialFuelCell] = useState<FuelCellSetState[] | undefined>();
  const [initialOperation, setInitialOperation] = useState<
    Partial<OperationInputState> | undefined
  >();
  const [initialSettings, setInitialSettings] = useState<EconomicsSettings | undefined>();
  const [initialTitle, setInitialTitle] = useState<string | null | undefined>();
  const [loadedFromReport, setLoadedFromReport] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const [fuelCellSets, setFuelCellSets] = useState<FuelCellSetState[]>([]);
  const [fuelCellTotal, setFuelCellTotal] = useState(0);
  const [operationState, setOperationState] = useState<OperationInputState | null>(null);
  const [operationValid, setOperationValid] = useState(false);

  const [pending, startTransition] = useTransition();
  const [fcMsg, setFcMsg] = useState<Msg>(null);
  const [opMsg, setOpMsg] = useState<Msg>(null);

  // 1) clientId 확보 + 데이터 복원
  // reportId가 있으면 리포트 스냅샷에서 복원, 없으면 최신 입력에서 복원
  useEffect(() => {
    const id = getClientId();

    if (skipRestore) {
      // 초기화 직후 — 서버 복원 없이 즉시 빈 상태로
      Promise.resolve().then(() => {
        setClientId(id ?? '');
        setRestored(true);
      });
      return;
    }

    if (reportId) {
      Promise.resolve().then(() => setClientId(id ?? ''));
      loadReport(reportId).then((res) => {
        if (res.ok) {
          const snap = res.data.snapshot;
          setInitialFuelCell(
            snap.inputs.fuelCell.sets.map((s) => ({
              set_id: s.set_id,
              형식: s.형식,
              제조사: s.제조사,
              모델: s.모델,
              발전용량_kW: s.발전용량_kW,
              열생산용량_kW: s.열생산용량_kW,
              설치수량: s.설치수량,
              kW당설치단가_override: s.kW당설치단가_override ?? null,
              kW당연간유지비용_override: s.kW당연간유지비용_override ?? null,
            })),
          );
          setInitialOperation(snap.inputs.operation);
          setInitialSettings(snap.settings as EconomicsSettings);
          setInitialTitle(res.data.title);
          setLoadedFromReport(reportId);
        }
        setRestored(true);
      });
      return;
    }

    if (!id) {
      Promise.resolve().then(() => {
        setClientId('');
        setRestored(true);
      });
      return;
    }
    loadLatestInputs(id).then((res) => {
      setClientId(id);
      if (res.ok) {
        if (res.data.fuelCell) {
          setInitialFuelCell(
            res.data.fuelCell.sets.map((s) => ({
              set_id: s.set_id,
              형식: s.형식,
              제조사: s.제조사,
              모델: s.모델,
              발전용량_kW: s.발전용량_kW,
              열생산용량_kW: s.열생산용량_kW,
              설치수량: s.설치수량,
            })),
          );
        }
        if (res.data.operation) {
          setInitialOperation(res.data.operation);
        }
      }
      setRestored(true);
    });
  }, [reportId, skipRestore, resetKey]);

  function onReset() {
    if (!confirm('입력값과 결과를 모두 초기화하시겠습니까?')) return;
    setInitialFuelCell(undefined);
    setInitialOperation(undefined);
    setInitialSettings(undefined);
    setInitialTitle(undefined);
    setLoadedFromReport(null);
    setFuelCellSets([]);
    setFuelCellTotal(0);
    setOperationState(null);
    setOperationValid(false);
    setFcMsg(null);
    setOpMsg(null);
    setSkipRestore(true);
    setResetKey((k) => k + 1);
    if (reportId) router.replace('/');
  }

  // 콜백을 안정화 — 자식의 useEffect 무한 루프 방지
  const handleFuelCellChange = useCallback((sets: FuelCellSetState[], total: number) => {
    setFuelCellSets(sets);
    setFuelCellTotal(total);
  }, []);

  const handleOperationChange = useCallback((value: OperationInputState, valid: boolean) => {
    setOperationState(value);
    setOperationValid(valid);
  }, []);

  function onSaveFuelCell() {
    if (!clientId) return;
    const payload = {
      sets: fuelCellSets,
      총설치용량_kW: fuelCellTotal,
    };
    setFcMsg(null);
    startTransition(async () => {
      const res = await saveFuelCellInput(clientId, payload);
      setFcMsg(res.ok ? { kind: 'ok', text: '저장되었습니다.' } : { kind: 'err', text: res.error });
    });
  }

  function onSaveOperation() {
    if (!clientId || !operationState) return;
    setOpMsg(null);
    startTransition(async () => {
      const res = await saveOperationInput(clientId, operationState);
      setOpMsg(res.ok ? { kind: 'ok', text: '저장되었습니다.' } : { kind: 'err', text: res.error });
    });
  }

  if (!restored) {
    return <div className="p-8 text-zinc-500">불러오는 중...</div>;
  }

  return (
    <div className="space-y-10">
      {loadedFromReport && (
        <div className="border border-blue-300 bg-blue-50 rounded p-3 text-sm text-blue-900 flex items-center gap-3">
          <span className="flex-1">
            저장된 리포트에서 입력값과 설정을 불러왔습니다. 수정 후 다시 저장할 수 있습니다.
          </span>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={onReset} variant="outline" size="sm">
          입력 초기화
        </Button>
      </div>
      <section className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">연료전지 정보 입력</h2>
            <p className="text-sm text-zinc-600">형식 → 제조사 → 모델 순으로 선택하세요.</p>
          </div>
          <Button
            type="button"
            onClick={onSaveFuelCell}
            disabled={pending || !clientId}
            className="shrink-0"
          >
            {pending ? '저장 중...' : '연료전지 정보 저장'}
          </Button>
        </header>

        <FuelCellSetList
          key={`fc-${resetKey}`}
          library={fuelCellLibrary}
          initial={initialFuelCell}
          onChange={handleFuelCellChange}
        />

        {fcMsg && (
          <div className={fcMsg.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
            {fcMsg.text}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">운전시간 입력</h2>
            <p className="text-sm text-zinc-600">연간 운전유형과 일일 운전시간을 입력하세요.</p>
          </div>
          <Button
            type="button"
            onClick={onSaveOperation}
            disabled={pending || !clientId || !operationValid}
            className="shrink-0"
          >
            {pending ? '저장 중...' : '운전시간 저장'}
          </Button>
        </header>

        <OperationProfileSelector
          key={`op-${resetKey}`}
          library={operationLibrary}
          initial={initialOperation}
          onChange={handleOperationChange}
        />

        {opMsg && (
          <div className={opMsg.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
            {opMsg.text}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">결과</h2>
        <ResultsSection
          key={`results-${resetKey}`}
          fuelCellSets={fuelCellSets}
          fuelCellTotal={fuelCellTotal}
          operation={operationState}
          operationValid={operationValid}
          libraries={libraries}
          initialSettings={initialSettings}
          initialTitle={initialTitle}
        />
      </section>

      <footer className="text-xs text-zinc-400 border-t pt-4">
        client_id: <code>{clientId || '(미할당)'}</code>
      </footer>
    </div>
  );
}
