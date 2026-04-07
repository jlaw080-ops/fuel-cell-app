# 실행 계획: Phase 2 — 입력 화면 (탭1)

> 상태: 대기중
> 전제: Phase 1 완료 (Next.js 16 + Supabase 연결 + Vercel 배포 파이프라인)
> 사전 학습: [nextjs16-notes.md](../../nextjs16-notes.md) (Next 16 변경점 — 반드시 먼저 읽을 것)

## 목표
탭1(입력 화면)을 구현한다. 사용자가 라이브러리 기반으로 연료전지 제품과 운전 시간을 입력하고, 입력값을 Supabase에 저장/불러올 수 있는 상태를 만든다.

## 범위 (PLANS.md Phase 2 기준)
- 라이브러리 JSON 로딩 및 드롭다운 연결
- 연료전지 세트 추가/삭제 UI (Input1)
- 운전시간 입력 UI (Input2)
- Supabase 저장/불러오기 (Server Action 패턴)

> 계산 로직(Phase 3), 경제성(Phase 4), 디자인 다듬기(Phase 7)는 본 페이즈 범위 외.

---

## 사전 결정사항 (확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| **인증 전략** | 익명 + Supabase RLS 전체 허용 | 사내 R&D 도구, 외부 노출 없음. Phase 5/6 재검토. |
| **세션 식별자** | `localStorage` UUID (`client_id` 컬럼) | 인증 없이 사용자별 입력 구분. Auth 도입 시 `user_id`로 마이그레이션. |
| **UI 라이브러리** | Tailwind v4만 (shadcn 미도입) | Phase 7에서 `ui-ux-pro-max` 스킬로 일괄 적용. 본 페이즈는 minimal. |
| **데이터 변경 패턴** | **Server Action** (Route Handler 미사용) | Next 16 권장 패턴. 폼 제출에 적합. `updateTag`로 즉시 UI 반영. |
| **입력 검증** | zod 사용 (Server Action 내부) | Server Action은 직접 POST 가능 → 서버측 검증 필수 ([nextjs16-notes §3](../../nextjs16-notes.md)) |

---

## 작업 목록

### 2-1. 데이터 로딩 계층
- [ ] `src/lib/data/loadLibraries.ts` — JSON 4종 로딩 헬퍼 (서버 컴포넌트용, `import` 정적 로딩)
- [ ] 라이브러리 → 타입 매핑 검증 ([src/types/fuelCell.ts](../../../src/types/fuelCell.ts), [tariff.ts](../../../src/types/tariff.ts), [operation.ts](../../../src/types/operation.ts)와 일치 확인)
- [ ] Vitest: 각 JSON이 타입 스키마에 맞는지 sanity 테스트
- [ ] zod 스키마: `src/lib/schemas/library.ts` — 런타임 JSON 검증

### 2-2. Supabase 스키마 + RLS
- [ ] 마이그레이션 SQL: `supabase/migrations/0001_init.sql`
- [ ] `fuel_cell_inputs` 테이블
  - `id uuid PK`, `client_id text not null`, `payload jsonb not null`, `created_at timestamptz default now()`
- [ ] `operation_inputs` 테이블
  - `id uuid PK`, `client_id text not null`, `payload jsonb not null`, `created_at timestamptz default now()`
- [ ] RLS 활성화 + 정책:
  ```sql
  alter table fuel_cell_inputs enable row level security;
  create policy "anon all" on fuel_cell_inputs
    for all to anon using (true) with check (true);
  -- operation_inputs 동일
  ```
- [ ] `client_id` 인덱스 (`create index on fuel_cell_inputs(client_id, created_at desc);`)

### 2-3. Supabase 클라이언트 (서버용 분리)
- [ ] [src/lib/supabase/client.ts](../../../src/lib/supabase/client.ts) (이미 존재) — 브라우저용 유지
- [ ] `src/lib/supabase/server.ts` 신규 — Server Action에서 사용 (현재는 동일한 publishable key. service_role 도입 시 분기)
- [ ] `src/lib/supabase/queries.ts` — 헬퍼: `getLatestFuelCellInput(clientId)`, `getLatestOperationInput(clientId)`

### 2-4. 세션 ID 헬퍼
- [ ] `src/lib/session/clientId.ts`
  ```ts
  export function getClientId(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('fc-app-client-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('fc-app-client-id', id);
    }
    return id;
  }
  ```
- [ ] Vitest: `localStorage` 모킹 후 동작 검증

### 2-5. 입력 검증 스키마 (zod)
- [ ] `src/lib/schemas/inputs.ts`
  - `fuelCellInputSchema` — 세트 배열, 각 세트의 형식/제조사/모델명/수량
  - `operationInputSchema` — 운전유형 enum, 운전시간 (0~24)
- [ ] [src/types/inputs.ts](../../../src/types/inputs.ts)와 일치 확인 (zod `infer` → 타입 일원화 검토)

### 2-6. Server Actions
- [ ] `src/lib/actions/inputs.ts`
  ```ts
  'use server';
  import { updateTag } from 'next/cache';
  import { fuelCellInputSchema, operationInputSchema } from '@/lib/schemas/inputs';
  import { supabase } from '@/lib/supabase/server';

  export async function saveFuelCellInput(clientId: string, raw: unknown) {
    const payload = fuelCellInputSchema.parse(raw);
    const { error } = await supabase
      .from('fuel_cell_inputs')
      .insert({ client_id: clientId, payload });
    if (error) throw error;
    updateTag(`fuel-cell-inputs:${clientId}`);
  }

  export async function saveOperationInput(clientId: string, raw: unknown) { /* ... */ }
  ```
- [ ] `loadLatestInputs(clientId)` — 불러오기 액션
- [ ] Vitest: Supabase 모킹하여 액션 단위 테스트

### 2-7. UI — Input1 (연료전지 정보)
- [ ] `src/components/tabs/Tab1Input.tsx` — 탭 컨테이너 (Server Component, 라이브러리 prop으로 주입)
- [ ] `src/components/inputs/FuelCellSetRow.tsx` (`'use client'`) — 캐스케이딩 드롭다운 (형식 → 제조사 → 모델명) + 설치수량
- [ ] `src/components/inputs/FuelCellSetList.tsx` (`'use client'`) — 세트 추가/삭제, 총설치용량 자동 계산
- [ ] React 19 `useActionState` + `useFormStatus`로 저장 상태 표시

### 2-8. UI — Input2 (운전시간 정보)
- [ ] `src/components/inputs/OperationProfileSelector.tsx` (`'use client'`) — 4종 운전유형 드롭다운
- [ ] 선택 시 월별 가동일 read-only 표시
- [ ] 일일 중간부하 / 최대부하 운전시간 input + 합계 ≤ 24h 검증
- [ ] zod 에러 표시 UI

### 2-9. 페이지 통합
- [ ] [src/app/page.tsx](../../../src/app/page.tsx) 수정 — 탭 컨테이너 진입점
- [ ] 라이브러리 4종을 Server Component에서 로드 → Client Component에 props로 전달
- [ ] 저장/불러오기 버튼 + 토스트 피드백 (간단한 inline 메시지)

### 2-10. 테스트
- [ ] Vitest: 라이브러리 로더 단위 테스트
- [ ] Vitest: zod 스키마 검증 (정상/실패 케이스)
- [ ] Vitest: 캐스케이딩 드롭다운 컴포넌트 (Testing Library)
- [ ] Vitest: Server Action 단위 테스트 (Supabase 모킹)
- [ ] Vitest: clientId 헬퍼

---

## 완료 조건
- [ ] `npm run lint` 에러 0
- [ ] `npm run test` 통과 (신규 테스트 포함)
- [ ] `npm run build` 성공
- [ ] 로컬 `npm run dev`에서 탭1 렌더링 + 드롭다운 동작 + 저장/불러오기 왕복 확인
- [ ] Vercel preview 배포에서 동일 동작 확인
- [ ] Supabase 대시보드에서 저장된 row 확인 (`client_id` 필터)

---

## 위험 / 주의사항

### Next.js 16 특이사항 ([nextjs16-notes.md](../../nextjs16-notes.md))
- `params`/`searchParams`/`cookies()` 사용 시 반드시 `await` (Phase 2에서는 dynamic segment 미사용 예정이지만 추후 주의)
- Server Action은 직접 POST로 호출 가능 → **모든 액션 내부에서 zod 검증 필수**
- `updateTag()`로 read-your-writes 보장 (`refresh()` 또는 `revalidatePath()` 대신)
- Server/Client 컴포넌트 경계 명확화 (`'use client'` 최소화)

### Supabase / 데이터
- 라이브러리 JSON 키가 한국어 → 변경 금지 ([CLADE.md](../../CLADE.md) 규칙)
- RLS 정책이 너무 관대함 (anon all) → Phase 5/6에서 인증 도입 시 재설계 필수
- `client_id`는 UUID이지만 신뢰할 수 없음 (사용자가 변조 가능). 민감 데이터 저장 금지.

### 의존성
- 신규 추가 패키지: `zod` (검증), 마이그레이션 도구 없음 (수동 SQL 실행)
- Supabase 마이그레이션은 대시보드 SQL Editor에서 직접 실행 또는 Supabase CLI 도입 결정 필요
