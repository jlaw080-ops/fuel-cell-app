# Phase 3 작업 인수인계 (Handoff) — 완료

> 작성일: 2026-04-08
> 세션: Claude Code (Opus 4.6)
> 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
> 이전 핸드오프: [PHASE2_HANDOFF.md](PHASE2_HANDOFF.md)

---

## 1. 요약

Phase 3(계산 로직)을 **순수 함수 + 단위 테스트** 방식으로 3단계(3a/3b/3c) 완료. UI는 Phase 4로 분리. 도메인 정확성을 손계산 일치로 잠근 상태.

| 단계            | 산출                                                                       | 테스트 | 커밋      |
| --------------- | -------------------------------------------------------------------------- | ------ | --------- |
| 3a 에너지 산출  | [src/lib/calc/energy/production.ts](src/lib/calc/energy/production.ts)     | 6      | `321548c` |
| 3b 수익         | [src/lib/calc/revenue/revenue.ts](src/lib/calc/revenue/revenue.ts)         | 7      | `3e25682` |
| 3c 경제성(20년) | [src/lib/calc/economics/economics.ts](src/lib/calc/economics/economics.ts) | 14     | `ba06fe1` |

**최종 검증**: lint ✅ / test **61/61** ✅ / build ✅. 푸시는 미실행.

---

## 2. Phase 2 마무리 처리

- 미사용 파일 [src/components/tabs/Tab1Input.tsx](src/components/tabs/Tab1Input.tsx) 삭제 (참조 0). FuelCellSetList 주석을 InputScreen 기준으로 수정.
- 보안 후속(토큰 revoke / DB 패스워드 reset) — 사용자 처리 완료 확인.

---

## 3. 사용자와 확정한 도메인 결정

### 3.0 공통

- **CO2 산출 모듈은 본 프로젝트에서 완전 제외** (앞으로도 고려하지 않음).
- 분석은 **연단위, 총 20년**.
- 입력 → 라이브러리 룩업은 **모델명 매칭**으로 처리. 입력 스키마는 변경하지 않음.

### 3.1 에너지 산출 (3a)

| 항목                | 결정                                                       |
| ------------------- | ---------------------------------------------------------- |
| 부분부하 효율       | 라이브러리에 없음 → **정격 출력 단순 비례**                |
| 가스 사용량         | 발전효율 역산 ❌, 라이브러리 `가스소비량_kW` **직접 사용** |
| 계약용량\_kW        | **총설치용량 자동** (`Σ 발전용량 × 수량`)                  |
| 중간/최대 시간 의미 | 단순 시간 합산. 같은 정격에 다른 단가만 적용됨 (3b에서)    |

**핵심 식**:

```
월간_중간부하_kWh = 계약용량 × 일일중간h × 월별가동일
월간_최대부하_kWh = 계약용량 × 일일최대h × 월별가동일
월간_열생산_kWh   = Σ(세트.열생산용량 × 수량) × (중간h+최대h) × 월별가동일
월간_가스사용_kWh = Σ(라이브러리[모델].가스소비량_kW × 수량) × (중간h+최대h) × 월별가동일
```

### 3.2 수익 (3b)

| 항목           | 결정                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| 발전수익       | 중간부하h → 라이브러리 **중간부하** 단가, 최대부하h → **최대부하** 단가 |
| 한전 기본요금  | **계약용량\_kW × 8320 원/kW/월** 매월 절감으로 **가산** (옵션 b)        |
| 열수익         | `열kWh × 일반가스단가 / 보일러효율` (대체된 보일러 연료비)              |
| 보일러 효율    | **디폴트 0.85**, 사용자 수정 가능 (`boilerEfficiency` 파라미터)         |
| 가스 단가 매핑 | 가스사용요금 → **연료전지전용**, 열수익 환산 → **일반용(영업1)**        |
| 경부하         | 사용 입력 없음 → 미적용                                                 |

```
발전수익  = 중간kWh × 중간단가 + 최대kWh × 최대단가 + 계약용량 × 기본요금
열수익    = 열kWh × 일반가스단가 / 보일러효율
가스요금  = 가스kWh × 연료전지전용 단가
최종수익  = 발전수익 + 열수익 − 가스요금
```

### 3.3 경제성 (3c)

| 항목                                     | 디폴트                                        | 사용자 수정                    |
| ---------------------------------------- | --------------------------------------------- | ------------------------------ |
| 분석기간 (`lifetime`)                    | 20년                                          | ✅                             |
| 할인율 (`discountRate`)                  | 0.02 (명목)                                   | ✅                             |
| 유지보수 모드 (`maintenanceMode`)        | `'fixedCost'` (라이브러리 `kW당연간유지비용`) | ✅ (`'ratio'` 토글)            |
| 유지보수 비율 (`maintenanceRatio`)       | 0.08 (CAPEX 대비)                             | ✅ (ratio 모드일 때만)         |
| 전기상승률 (`electricityEscalation`)     | 0                                             | ✅                             |
| 가스상승률 (`gasEscalation`)             | 0                                             | ✅ (열수익·가스요금 동시 적용) |
| 유지보수상승률 (`maintenanceEscalation`) | 0                                             | ✅                             |
| Summary 기간 (`summaryPeriods`)          | `[5,10,15,20]`                                | ✅                             |

**기준 연간값** = 3b 산출의 12개월 합계.

**연도별 산식 (1년차 baseline)**:

```
elec_t  = base.발전수익 × (1+e)^(t-1)
heat_t  = base.열수익   × (1+g)^(t-1)
gas_t   = base.가스요금 × (1+g)^(t-1)
maint_t = base.maint    × (1+m)^(t-1)
총수익_t = elec_t + heat_t − gas_t
순현금흐름_t = 총수익_t − maint_t
할인_t = 순현금흐름_t / (1+r)^t
```

**0년차** = `−CAPEX` (총수익 0, 유지비 0).
**스택 교체비**(PEMFC 7~10년)는 무시 — 유지보수비/유지보수비율에 포함된 것으로 간주(사용자 결정).

**LCOE** (전기만 분모):

```
LCOE = (CAPEX + Σ_{t=1..N} maint_t/(1+r)^t)
     /  Σ_{t=1..N} elecGen / (1+r)^t
```

**Summary 표 (5/10/15/20년)**:

- 누적수익, 누적유지비, 초기투자비용, 총비용
- ROI\_초기투자 = (누적수익 − 총비용) / CAPEX
- ROI\_총비용 = (누적수익 − 총비용) / 총비용
- NPV = `npv(r, cashflows[0..k])`
- IRR = `irr(cashflows[0..k])` (Newton-Raphson)

**회수기간**: `calcPaybackYears(annual)` — 누적순현금흐름이 0을 넘는 연도(선형보간), 회수 불가 시 `null`.

---

## 4. 디렉토리 구조

```
src/lib/calc/
├── energy/
│   ├── production.ts
│   └── __tests__/production.test.ts
├── revenue/
│   ├── revenue.ts
│   └── __tests__/revenue.test.ts
└── economics/
    ├── economics.ts
    └── __tests__/economics.test.ts
```

> 빈 디렉토리 [src/lib/calculations/](src/lib/calculations/) 는 그대로 남아 있음. Phase 4 진입 전 정리 권장.

---

## 5. Public API (Phase 4 UI에서 호출 시)

```ts
import { calcEnergyProduction } from '@/lib/calc/energy/production';
import { calcEnergyRevenue, DEFAULT_BOILER_EFFICIENCY } from '@/lib/calc/revenue/revenue';
import {
  calcEconomics,
  calcPaybackYears,
  DEFAULTS as ECON_DEFAULTS,
  type EconomicsParams,
  type EconomicsResult,
  type MaintenanceMode,
} from '@/lib/calc/economics/economics';
```

**호출 흐름** (Phase 4 InputScreen → 출력화면):

```ts
const production = calcEnergyProduction({
  fuelCell,
  operation,
  fuelCellLibrary,
  operationLibrary,
});
const revenue = calcEnergyRevenue({
  production,
  electricityTariff,
  gasTariff,
  // boilerEfficiency: 0.85 (기본)
});
const econ = calcEconomics({
  fuelCell,
  fuelCellLibrary,
  production,
  revenue,
  // 모든 경제성 파라미터는 옵션 — UI에서 사용자 입력으로 override
});
const payback = calcPaybackYears(econ.annual);
```

> **유의**: Phase 4에서 `loadAllLibraries()`로 4종 라이브러리를 한번에 로드하여 InputScreen 또는 결과 화면에 props로 주입해야 함. 현재 [src/app/page.tsx](src/app/page.tsx)는 fuelCell/operation 두 개만 로드 중.

---

## 6. 알려진 사항 / 미해결

1. **빈 폴더** [src/lib/calculations/](src/lib/calculations/) 정리 (옵션). 또는 향후 다른 보조 모듈용으로 보존.
2. **vite-tsconfig-paths 경고** — Vitest 4가 네이티브 지원. [vitest.config.ts](vitest.config.ts)에서 플러그인 제거 가능 (Phase 2부터 미처리).
3. **라이브러리 단가 null 모델 처리** — 일부 모델(`두산 PureCell®M400`, `Doosan S300`, `블룸SK퓨얼셀`, `미코파워 150kW`, `DS-SO-10-21A`)은 `kW당설치단가` / `kW당연간유지비용` 가 null. 현재 정책: **사용자 수동 입력 fallback** (사용자 결정 b). 그러나 입력 스키마/UI에 단가 override 필드는 **아직 없음**. Phase 4에서 추가 필요.
4. **열생산용량 null 모델** (`Doosan S300`, `블룸SK퓨얼셀`, `미코파워 150kW`) — 열생산 0 기여로 처리. 가스소비량까지 null이면 가스요금/열수익 모두 null.
5. **회수기간 단위** — 현재 단순 회수기간만. **할인 회수기간**은 미구현. 필요 시 추가.
6. **요금상승률 일관성** — 할인율 명목 통일(사용자 결정). 별도 안내 없음.
7. **Phase 3 계획서**는 [harness-docs/docs/exec-plans/active/phase3-calculation.md](harness-docs/docs/exec-plans/active/phase3-calculation.md). CO2 모듈(3b 환경) 항목은 사용자 결정으로 **삭제됨** — 계획서 자체는 미수정 상태. 다음 세션에서 정리하거나 archive로 이동 권장.

---

## 7. 검증 결과 (Phase 3 종료 시점)

| 명령            | 결과                                                                           |
| --------------- | ------------------------------------------------------------------------------ |
| `npm run lint`  | ✅ 에러 0, 경고 0                                                              |
| `npm run test`  | ✅ **61/61**                                                                   |
| `npm run build` | ✅ 성공                                                                        |
| `git push`      | ❌ **미실행** — 다음 세션 시작 시 처리 권장                                    |
| Vercel 배포     | ❌ 미실행 (계산 모듈만 추가, UI 변경 없음 → 푸시 후 자동 배포되어도 동작 동일) |

**테스트 분포**: sanity 1 + library 5 + clientId 2 + inputs 6 + actions 10 + FuelCellSetRow 5 + OperationProfileSelector 5 + production 6 + revenue 7 + economics 14 = **61**

---

## 8. Git 상태

- 최신 커밋: `ba06fe1 Phase 3c: economics calc (20-year annual, NPV/IRR/LCOE)`
- 본 세션 신규 커밋 3개 (모두 main 브랜치):
  - `321548c` Phase 3a: energy production calc + remove unused Tab1Input
  - `3e25682` Phase 3b: revenue calc
  - `ba06fe1` Phase 3c: economics calc (20-year annual, NPV/IRR/LCOE)
- **푸시 미완** — `git push origin main` 필요
- 미커밋: 본 핸드오프 문서

---

## 9. 다음 세션 체크리스트 (Phase 4 시작)

1. **`git push origin main`** — Phase 3 3개 커밋 + 핸드오프 푸시
2. 본 핸드오프 + [PHASE2_HANDOFF.md](PHASE2_HANDOFF.md) + [phase3-calculation.md](harness-docs/docs/exec-plans/active/phase3-calculation.md) 우선 읽기
3. **Phase 4 계획 수립** — 출력 화면 UI. exec-plan 신규 작성 권장. 범위 후보:
   - 탭2: 에너지 산출 (월별 12행 + 합계, 발전/열/가스)
   - 탭3: 수익 (월별 12행, 발전/열/가스/최종)
   - 탭4: 경제성 (연도별 21행 + Summary 4행 + LCOE/회수기간 카드 + 경제성 입력 패널)
   - 또는 단일 결과 페이지(스크롤 섹션)로 통합
4. **경제성 입력 패널** — 분석기간/할인율/유지모드/비율/상승률 3종/보일러효율. 어디에 둘지(사이드바 vs Input3 탭) 결정 필요.
5. **차트 도입 여부** — Recharts 등. 표만으로 충분하면 의존성 추가 불필요.
6. **라이브러리 단가 null 모델** UI fallback (수동 입력 필드) 추가.
7. [src/app/page.tsx](src/app/page.tsx) — 라이브러리 로딩을 `loadAllLibraries()`로 확장.
8. 빈 폴더 [src/lib/calculations/](src/lib/calculations/) 처리 결정.
9. Phase 3 계획서에서 CO2(3b 환경) 섹션 삭제 또는 archive 이동.

---

## 10. 참고 명령어

```bash
cd /c/Users/jlaw8/dev/fuel-cell-app

# 검증
npm run lint
npm run test
npm run build

# 특정 모듈만 테스트
npx vitest run src/lib/calc/economics/__tests__/economics.test.ts

# 푸시 (Phase 3 마무리)
git push origin main
```
