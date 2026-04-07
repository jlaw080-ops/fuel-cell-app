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
import type { FuelCellLibrary } from '@/types/fuelCell';
import type { OperationLibrary } from '@/types/operation';
import { getClientId } from '@/lib/session/clientId';
import { saveFuelCellInput, saveOperationInput, loadLatestInputs } from '@/lib/actions/inputs';
import { FuelCellSetList } from '@/components/inputs/FuelCellSetList';
import type { FuelCellSetState } from '@/components/inputs/FuelCellSetRow';
import {
  OperationProfileSelector,
  type OperationInputState,
} from '@/components/inputs/OperationProfileSelector';

interface Props {
  fuelCellLibrary: FuelCellLibrary;
  operationLibrary: OperationLibrary;
}

type Msg = { kind: 'ok' | 'err'; text: string } | null;

export function InputScreen({ fuelCellLibrary, operationLibrary }: Props) {
  const [clientId, setClientId] = useState<string>('');
  const [initialFuelCell, setInitialFuelCell] = useState<FuelCellSetState[] | undefined>();
  const [initialOperation, setInitialOperation] = useState<
    Partial<OperationInputState> | undefined
  >();
  const [restored, setRestored] = useState(false);

  const [fuelCellSets, setFuelCellSets] = useState<FuelCellSetState[]>([]);
  const [fuelCellTotal, setFuelCellTotal] = useState(0);
  const [operationState, setOperationState] = useState<OperationInputState | null>(null);
  const [operationValid, setOperationValid] = useState(false);

  const [pending, startTransition] = useTransition();
  const [fcMsg, setFcMsg] = useState<Msg>(null);
  const [opMsg, setOpMsg] = useState<Msg>(null);

  // 1) clientId 확보 + 최신 데이터 복원
  // setState는 모두 비동기 콜백 내부에서 호출 (react-hooks/set-state-in-effect 회피)
  useEffect(() => {
    const id = getClientId();
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
          // payload의 sets를 컴포넌트 상태로 변환 (set_id 보존)
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
  }, []);

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
      <section className="space-y-4">
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold">연료전지 정보 입력</h2>
            <p className="text-sm text-zinc-600">형식 → 제조사 → 모델 순으로 선택하세요.</p>
          </div>
          <button
            type="button"
            onClick={onSaveFuelCell}
            disabled={pending || !clientId}
            className="px-4 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50"
          >
            {pending ? '저장 중...' : '연료전지 정보 저장'}
          </button>
        </header>

        <FuelCellSetList
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
        <header className="flex items-baseline justify-between">
          <div>
            <h2 className="text-xl font-semibold">운전시간 입력</h2>
            <p className="text-sm text-zinc-600">연간 운전유형과 일일 운전시간을 입력하세요.</p>
          </div>
          <button
            type="button"
            onClick={onSaveOperation}
            disabled={pending || !clientId || !operationValid}
            className="px-4 py-2 bg-zinc-900 text-white rounded text-sm disabled:opacity-50"
          >
            {pending ? '저장 중...' : '운전시간 저장'}
          </button>
        </header>

        <OperationProfileSelector
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

      <footer className="text-xs text-zinc-400 border-t pt-4">
        client_id: <code>{clientId || '(미할당)'}</code>
      </footer>
    </div>
  );
}
