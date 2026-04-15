# Phase 13 핸드오프 — 라이브러리 데이터 Supabase 마이그레이션

**완료일:** 2026-04-15
**브랜치:** main
**커밋:** `aea961a`

---

## 목표

로컬 JSON 파일로 관리하던 라이브러리 데이터(연료전지 제품, 가동일 프로파일, 전기요금, 가스요금)를 Supabase 테이블로 이전하여, 코드 배포 없이 데이터를 수정·관리할 수 있도록 한다.

---

## 완료된 작업

### Task A — Supabase 테이블 생성

**파일:** `supabase/migrations/001_create_library_tables.sql`

생성된 테이블:

| 테이블명                     | 내용                            |
| ---------------------------- | ------------------------------- |
| `fuel_cell_products`         | 연료전지 제품 라이브러리        |
| `operation_profiles`         | 월별 가동일 프로파일            |
| `electricity_tariff_plans`   | 전기요금 플랜 헤더              |
| `electricity_tariff_monthly` | 전기요금 월별 단가 (plan_id FK) |
| `gas_tariffs`                | 가스요금 라이브러리             |

- 모든 테이블에 RLS 활성화 + 공개 읽기 Policy 설정 (로그인 없이 조회 가능)

### Task B — 초기 데이터 시드

**파일:** `supabase/migrations/002_seed_library_data.sql`

기존 JSON 4개 파일의 데이터를 SQL INSERT로 변환하여 삽입.

### Task C — 로더 함수 async 전환

**파일:** `src/lib/data/loadLibraries.ts`

| 변경 전                | 변경 후                        |
| ---------------------- | ------------------------------ |
| JSON 정적 import       | Supabase 런타임 조회           |
| 동기 함수 (`function`) | 비동기 함수 (`async function`) |
| 빌드 타임 번들링       | 요청마다 최신 데이터 반환      |

```ts
// 변경 후 구조 (예시)
export async function loadFuelCellLibrary(): Promise<FuelCellLibrary> {
  const { data, error } = await supabaseServer
    .from('fuel_cell_products').select('*').order('id');
  // ... mapping + zod 검증
}

export async function loadAllLibraries(): Promise<AllLibraries> {
  const [fuelCell, operation, electricity, gas] = await Promise.all([...]);
  return { fuelCell, operation, electricity, gas };
}
```

### Task D — page.tsx await 추가

**파일:** `src/app/page.tsx`

```ts
// 변경 전
const libraries = loadAllLibraries();

// 변경 후
const libraries = await loadAllLibraries();
```

### Task E — 테스트 재작성 + vitest 설정 수정

**파일:** `src/lib/data/__tests__/loadLibraries.test.ts`

- Supabase 클라이언트를 `vi.mock`으로 모킹
- 픽스처 데이터로 5개 테스트 전부 통과

**파일:** `vitest.config.ts`

- `server-only` 패키지를 vitest 환경에서 resolve할 수 있도록 alias 추가

**파일:** `src/test/__mocks__/server-only.ts`

- `server-only` 빈 스텁 파일 추가

---

## 데이터 관리 방법 (운영 가이드)

### 제품/요금 데이터 수정

**Supabase Studio → Table Editor** 에서 셀 클릭 후 편집 → Enter로 즉시 저장.  
재배포 불필요. 페이지 새로고침 시 바로 반영.

### 새 요금제 추가 등 복잡한 변경

`supabase/migrations/003_...sql` 파일 생성 후 SQL Editor에서 실행.

```sql
-- 예: 가스요금 단가 변경
UPDATE gas_tariffs SET unit_price_per_kwh = 4.25 WHERE name = '연료전지전용';

-- 예: 신규 연료전지 제품 추가
INSERT INTO fuel_cell_products (type, manufacturer, model_name, ...)
VALUES ('PEMFC', '제조사명', '모델명', ...);
```

---

## 현재 상태

| 항목                         | 상태                         |
| ---------------------------- | ---------------------------- |
| TypeScript 타입 체크         | 통과                         |
| 테스트 (loadLibraries 5개)   | 통과                         |
| 테스트 (FuelCellSetRow 3개)  | 기존 실패 (Phase 13 범위 외) |
| Supabase 실 데이터 반영 확인 | 완료                         |

---

## 다음 작업 후보

- FuelCellSetRow shadcn Select 이벤트 미발화 버그 수정 (기존 테스트 3개 실패 원인)
- 전기요금 다중 플랜 선택 UI (현재는 `is_active=true` 1개만 사용)
- 관리자 페이지: 라이브러리 데이터 CRUD UI (코드 없이 데이터 관리)
