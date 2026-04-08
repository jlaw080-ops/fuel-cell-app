# Phase 2 작업 인수인계 (Handoff) — 진행 중

> 작성일: 2026-04-07
> 세션: Claude Code (Opus 4.6)
> 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
> 이전 핸드오프: [PHASE1_HANDOFF.md](PHASE1_HANDOFF.md)

---

## 1. 이번 세션 요약

> **업데이트 (2026-04-08)**: Phase 2 작업 2-1 ~ 2-10 **전체 완료**. 입력 화면(연료전지 정보 + 운전시간) 구현, Server Action 저장/복원 라운드트립 수동 검증 OK. 다음 세션은 **Phase 3 계산 로직(LCOE/경제성)** 부터 시작.

Phase 1 보류 항목 3개를 모두 해소하고, Phase 2 계획 수립 후 작업 2-1 ~ 2-5까지 완료. 다음 세션은 **2-6 Server Actions**부터 이어가면 됨.

---

## 2. Phase 1 보류 항목 — 모두 완료 ✅

| 항목          | 결과                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| Supabase 연결 | publishable key로 [.env.local](.env.local) 작성, [src/lib/supabase/client.ts](src/lib/supabase/client.ts) 작성 |
| GitHub remote | https://github.com/jlaw080-ops/fuel-cell-app — `main` 브랜치 푸시 완료                                         |
| Vercel 배포   | 사용자가 옵션 B(대시보드 GitHub 연동)로 직접 배포 완료. `git push` 자동 배포 활성화                            |

### 부가 처리

- Next.js Turbopack 다중 lockfile 경고 해소: [next.config.ts](next.config.ts)에 `turbopack.root` 명시
- 로컬 git 브랜치 `master` → `main` 리네임
- `.env.local`은 `.gitignore`에 포함되어 미커밋 상태 유지

---

## 3. Phase 2 계획 수립

### 3.1 사전 학습

- **Next.js 16 docs 스캔 후** [harness-docs/docs/nextjs16-notes.md](harness-docs/docs/nextjs16-notes.md) 작성
- 핵심 발견:
  - Async Request APIs: `params`/`searchParams`/`cookies()` 모두 `await` 필수
  - Server Action 권장 (Route Handler 대신)
  - `updateTag()`로 read-your-writes (신규 API)
  - `middleware` → `proxy` 리네임
  - `next lint` 명령 제거 (이미 ESLint CLI 직접 호출)
  - Turbopack 기본 (이미 적용됨)

### 3.2 Phase 2 결정사항 (확정)

| 항목                  | 결정                                                 |
| --------------------- | ---------------------------------------------------- |
| 인증 전략             | **익명 + Supabase RLS 전체 허용** (Phase 5/6 재검토) |
| 세션 식별자           | **localStorage UUID** (`client_id` 컬럼)             |
| UI 라이브러리         | Tailwind v4만, shadcn 미도입 (Phase 7 일괄)          |
| 데이터 변경 패턴      | **Server Action** + `updateTag`                      |
| 입력 검증             | zod (Server Action 내부 필수)                        |
| Supabase 마이그레이션 | **Supabase CLI** (npx supabase)                      |

### 3.3 계획서

- [harness-docs/docs/exec-plans/active/phase2-input-screen.md](harness-docs/docs/exec-plans/active/phase2-input-screen.md) — 작업 2-1 ~ 2-10 (10개 그룹)

---

## 4. 신규 의존성 설치

| 패키지              | 용도                            |
| ------------------- | ------------------------------- |
| `zod`               | 라이브러리/입력 검증            |
| `supabase` (devDep) | CLI v2.86.0 — 마이그레이션 관리 |

---

## 5. Supabase CLI 설정

```bash
npx supabase init                                          # supabase/config.toml 생성
npx supabase link --project-ref gdiwewatuwzfopzpdnfj       # 원격 프로젝트 링크 (토큰+패스워드 필요)
npx supabase db push                                       # 마이그레이션 원격 적용
```

링크 시 환경변수 2개 필요:

- `SUPABASE_ACCESS_TOKEN` — https://supabase.com/dashboard/account/tokens
- `SUPABASE_DB_PASSWORD` — Project Settings → Database

> ⚠️ **보안 후속 조치 필요**: 본 세션에서 사용한 토큰과 DB 패스워드는 채팅에 노출되었음. 다음 사항을 **즉시** 처리할 것:
>
> 1. Supabase 대시보드 → Database → Reset Password
> 2. Account Tokens → 사용한 토큰 revoke
> 3. 새 토큰/패스워드는 [.env.local](.env.local)이나 OS keyring에 저장 (채팅 금지)

---

## 6. 완료된 작업 (Phase 2-1 ~ 2-5)

### 6.1 작업 2-2: Supabase 마이그레이션

**파일**: [supabase/migrations/20260407000001_init_inputs.sql](supabase/migrations/20260407000001_init_inputs.sql)

생성된 객체 (원격 적용 완료):

- `fuel_cell_inputs` 테이블 (`id`, `client_id`, `payload jsonb`, `created_at`)
- `operation_inputs` 테이블 (동일 구조)
- 인덱스 2개 — `(client_id, created_at desc)`
- RLS 활성화 + `anon_all_*` 정책 2개 (anon role 전체 허용)

### 6.2 작업 2-1: 라이브러리 로딩

| 파일                                                                                         | 내용                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [src/lib/schemas/library.ts](src/lib/schemas/library.ts)                                     | 4종 라이브러리 zod 스키마 (`fuelCellLibrarySchema`, `operationLibrarySchema`, `electricityTariffLibrarySchema`, `gasTariffLibrarySchema`) |
| [src/lib/data/loadLibraries.ts](src/lib/data/loadLibraries.ts)                               | 로더 5개: `loadFuelCellLibrary`, `loadOperationLibrary`, `loadElectricityTariff`, `loadGasTariff`, `loadAllLibraries`                     |
| [src/lib/data/**tests**/loadLibraries.test.ts](src/lib/data/__tests__/loadLibraries.test.ts) | 5개 테스트 케이스                                                                                                                         |

특이사항:

- 한국어 파일명을 `@/data/연료전지제품라이브러리.json` 형태로 직접 import
- `tsconfig.json`의 `resolveJsonModule: true` 활용
- zod로 런타임 검증 → 타입과 JSON 키 일치 보장

### 6.3 작업 2-3: Supabase 서버 클라이언트

**파일**: [src/lib/supabase/server.ts](src/lib/supabase/server.ts)

- `import 'server-only'` 가드
- `persistSession: false`
- 현재는 publishable key 사용 (브라우저용과 동일). service_role 도입 시 본 파일에서 분기.

### 6.4 작업 2-4: 세션 ID 헬퍼

| 파일                                                                                     | 내용                                                                    |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [src/lib/session/clientId.ts](src/lib/session/clientId.ts)                               | `getClientId()`, `resetClientId()` — localStorage 키 `fc-app-client-id` |
| [src/lib/session/**tests**/clientId.test.ts](src/lib/session/__tests__/clientId.test.ts) | 2개 테스트                                                              |

특이사항:

- jsdom의 localStorage가 vitest 4 + Windows에서 정상 동작하지 않아 (`window.localStorage.clear is not a function`), 테스트는 `vi.stubGlobal`로 직접 모킹
- 본 패턴은 추후 다른 localStorage 관련 테스트에도 적용 권장

### 6.5 작업 2-5: 입력 zod 스키마

| 파일                                                                                 | 내용                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| [src/lib/schemas/inputs.ts](src/lib/schemas/inputs.ts)                               | `fuelCellInputSetSchema`, `fuelCellInputSchema`, `operationInputSchema` (`refine`으로 24h 합계 검증) |
| [src/lib/schemas/**tests**/inputs.test.ts](src/lib/schemas/__tests__/inputs.test.ts) | 6개 테스트                                                                                           |

---

## 7. 검증 결과 (현재 상태)

| 명령             | 결과                                                        |
| ---------------- | ----------------------------------------------------------- |
| `npm run lint`   | ✅ 에러 0                                                   |
| `npm run test`   | ✅ **14/14** (sanity 1 + library 5 + clientId 2 + inputs 6) |
| `npm run build`  | ✅ 성공                                                     |
| `npm run format` | (미실행)                                                    |

**알려진 경고**

- `vite-tsconfig-paths` deprecation 경고 — Vitest 4가 네이티브 지원. 추후 [vitest.config.ts](vitest.config.ts)에서 플러그인 제거 가능.

---

## 8. Phase 2 완료 작업 (2-6 ~ 2-10)

> 본 섹션은 원래 "미완료 작업"이었으나 모두 완료되어 기록으로 보존.

### 검증 (최종)

- `npm run lint` ✅
- `npm run test` ✅ **34/34**
- `npm run build` ✅
- 로컬 dev 라운드트립 (저장 → 새로고침 복원) ✅ 사용자 확인

### 주요 산출물

- [src/lib/actions/inputs.ts](src/lib/actions/inputs.ts) — `saveFuelCellInput`, `saveOperationInput`, `loadLatestInputs`. 캐싱 미적용(`updateTag` 생략), 반환은 `{ok,data}|{ok,error}`.
- [src/components/inputs/FuelCellSetRow.tsx](src/components/inputs/FuelCellSetRow.tsx) — 캐스케이딩 드롭다운(형식→제조사→모델), 모델 선택 시 발전·열용량 자동 채움.
- [src/components/inputs/FuelCellSetList.tsx](src/components/inputs/FuelCellSetList.tsx) — 세트 추가/삭제, 총설치용량 자동 합산.
- [src/components/inputs/OperationProfileSelector.tsx](src/components/inputs/OperationProfileSelector.tsx) — 운전유형 + 월별 가동일 read-only + 24h 합계 검증. **기본값 16h(중간) / 8h(최대)**.
- [src/components/tabs/InputScreen.tsx](src/components/tabs/InputScreen.tsx) — 통합 클라이언트 컴포넌트. clientId 확보, 마운트 시 복원, `useTransition` 저장, inline 메시지.
- [src/app/page.tsx](src/app/page.tsx) — Server Component, 라이브러리 4종 중 fuelCell/operation 로드 후 InputScreen 주입.
- [src/components/tabs/Tab1Input.tsx](src/components/tabs/Tab1Input.tsx) — 2-7 작성된 단일 컨테이너. 현재 InputScreen으로 대체되어 **미사용** (Phase 3 또는 정리 시 삭제 결정).
- 신규 컴포넌트 테스트: `__tests__/FuelCellSetRow.test.tsx`(5), `__tests__/OperationProfileSelector.test.tsx`(5)

### React 19 특이사항 (해소 기록)

- `react-hooks/set-state-in-effect` 룰: useEffect 본문에서 직접 setState 금지. → 모든 setState를 `Promise.then()` 콜백 내부로 이동하여 회피 (InputScreen.tsx)
- `useCallback`으로 자식 onChange 안정화하여 자식의 useEffect 무한 루프 방지

### 원본 계획 (참고용)

[phase2-input-screen.md](harness-docs/docs/exec-plans/active/phase2-input-screen.md)의 작업 2-6 ~ 2-10:

### 2-6. Server Actions ⏭ **다음 시작점**

- `src/lib/actions/inputs.ts`
  - `saveFuelCellInput(clientId, raw)` — zod 검증 → upsert → `updateTag(`fuel-cell-inputs:${clientId}`)`
  - `saveOperationInput(clientId, raw)` — 동일 패턴
  - `loadLatestInputs(clientId)` — 두 테이블에서 최신 row 1개씩
- Vitest: Supabase 모킹하여 단위 테스트

### 2-7. UI — Input1 (연료전지 정보)

- `src/components/tabs/Tab1Input.tsx` (Server Component)
- `src/components/inputs/FuelCellSetRow.tsx` (`'use client'`) — 캐스케이딩 드롭다운
- `src/components/inputs/FuelCellSetList.tsx` (`'use client'`)
- React 19 `useActionState` + `useFormStatus`

### 2-8. UI — Input2 (운전시간)

- `src/components/inputs/OperationProfileSelector.tsx`
- 운전시간 input + 합계 검증 UI

### 2-9. 페이지 통합

- [src/app/page.tsx](src/app/page.tsx) 수정 — 탭 진입점, 라이브러리 props 주입

### 2-10. 테스트 마무리

- 컴포넌트 테스트 (Testing Library)
- E2E 흐름 점검

---

## 9. Git 상태

- 마지막 커밋: `Initial commit: Phase 1 setup` (Phase 1 완료 시점)
- 본 세션 작업물은 **모두 미커밋** 상태
- 신규 untracked / modified 파일:
  - `.env.local` (gitignore — 미커밋 OK)
  - `next.config.ts` (turbopack.root 추가)
  - `package.json`, `package-lock.json` (zod, supabase 추가)
  - `supabase/` (config.toml, migrations/)
  - `src/lib/schemas/` (library.ts, inputs.ts + tests)
  - `src/lib/data/` (loadLibraries.ts + tests)
  - `src/lib/supabase/server.ts`
  - `src/lib/session/` (clientId.ts + tests)
  - `harness-docs/docs/nextjs16-notes.md`
  - `harness-docs/docs/exec-plans/active/phase2-input-screen.md`
  - `PHASE2_HANDOFF.md` (이 문서)

다음 세션 시작 시 또는 Phase 2 완료 시점에 일괄 커밋 권장.

---

## 10. 다음 세션 체크리스트 (Phase 3 시작)

1. **보안 후속 조치**: Supabase 토큰 revoke + DB 패스워드 reset (위 §5 참조) — **여전히 미처리 시 우선 처리**
2. 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
3. 본 핸드오프 + [phase2-input-screen.md](harness-docs/docs/exec-plans/active/phase2-input-screen.md) + [nextjs16-notes.md](harness-docs/docs/nextjs16-notes.md) 우선 읽기
4. **Phase 3 계획 수립** — 계산 로직(LCOE, 경제성, 가스소비량/연간 발전량/CO2 절감 등). 신규 exec-plan 작성 권장.
5. 입력 스키마([src/lib/schemas/inputs.ts](src/lib/schemas/inputs.ts))와 라이브러리 스키마([src/lib/schemas/library.ts](src/lib/schemas/library.ts))를 출발점으로, 계산 함수는 `src/lib/calc/` 하위에 순수 함수로 작성.
6. 본 세션 작업물은 **모두 커밋 완료** (`f8479bc` + Phase 2 마무리 커밋).
7. 미사용 파일 [src/components/tabs/Tab1Input.tsx](src/components/tabs/Tab1Input.tsx) 정리 여부 결정.

---

## 11. 참고 명령어

```bash
cd /c/Users/jlaw8/dev/fuel-cell-app

# 개발/검증
npm run dev
npm run lint
npm run test
npm run build

# Supabase
npx supabase status
SUPABASE_ACCESS_TOKEN='...' SUPABASE_DB_PASSWORD='...' npx supabase db push
SUPABASE_ACCESS_TOKEN='...' npx supabase migration new <name>
```
