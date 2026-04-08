# Phase 3 — 계산 로직 (LCOE / 경제성)

> 작성일: 2026-04-08
> 선행: [PHASE2_HANDOFF.md](../../../../PHASE2_HANDOFF.md)
> 범위: 순수 계산 함수 + 단위 테스트. UI(출력 화면)는 Phase 4로 분리.

---

## 0. 원칙

- **순수 함수 우선**: `src/lib/calc/` 하위 모듈로, 부수효과 없음. UI/Server Action/DB 의존 X.
- **타깃 출력 = `src/types/outputs.ts`의 4종 구조** (`EnergyProductionOutput`, `EnergyRevenueOutput`, `AnnualEconomicsOutput`, `EconomicsSummaryOutput`).
- **입력**: Phase 2 zod 스키마(`fuelCellInputSetSchema`, `operationInputSchema`) + 라이브러리(전기/가스 요금) 그대로 사용.
- **각 단계 끝마다** lint/test/build 통과 + 커밋. 단계 간 의존이 명확하므로 순서 고정.
- **단위 테스트 필수** — 손계산 가능한 작은 케이스로 회귀 보호.

---

## 1. 디렉토리

```
src/lib/calc/
├── energy/
│   ├── production.ts          # 발전량/열생산량/가스사용량
│   └── __tests__/
├── environment/
│   ├── co2.ts                 # CO2 절감량
│   └── __tests__/
├── revenue/
│   ├── tariff.ts              # 전기/가스 요금 룩업·계산
│   ├── revenue.ts             # 월간 수익(발전·열·가스비)
│   └── __tests__/
├── economics/
│   ├── lcoe.ts                # 균등화발전원가
│   ├── cashflow.ts            # 연도별 현금흐름
│   ├── npv.ts                 # NPV / IRR / 회수기간 / ROI
│   └── __tests__/
└── index.ts                   # public re-exports
```

> 기존 빈 디렉토리 [src/lib/calculations/](../../../../src/lib/calculations/)는 이름이 길고 비어 있음 → 폐기하고 `calc/`로 신설. 또는 기존 폴더 재사용 결정 시 단계 3a 시작 전 확정.

---

## 2. 단계 분할

### 3a. 에너지 산출 (production)

**산출**: `EnergyProductionOutput`

입력:
- `FuelCellInputSet` (세트별 발전·열용량 kW, 수량)
- `OperationInput` (운전유형 → 월별 가동일, 일일 중간/최대 운전시간)
- 가스 변환 효율 (라이브러리 또는 상수 — 확인 필요)

함수:
- `calcMonthlyProduction(sets, op, opts) → EnergyProductionRow[12]`
- `summarizeProduction(rows) → EnergyProductionOutput`

핵심 식 (초안 — 사용자 확인):
```
월간 전력생산량(중간부하) = Σ(세트i 발전kW × 수량i) × 일일중간h × 월간가동일
월간 전력생산량(최대부하) = Σ(세트i 발전kW × 수량i) × 일일최대h × 월간가동일
월간 열생산량 = Σ(세트i 열kW × 수량i) × (일일중간h+일일최대h) × 월간가동일
월간 도시가스사용량_kWh = (총전력생산량 + 총열생산량) / 종합효율
```

**확인 필요**: 발전·열효율, 가스 LHV/HHV 기준, 부분부하 효율 — 라이브러리에서 추출되는지, 상수인지.

### 3b. 환경 (CO2)

**산출**: 단일 숫자 + 월별 어레이 (출력 타입 확장 필요 시 별도 인터페이스 신설)

- `calcCO2Reduction(production, factors) → { monthly[12], annual }`
- 배출계수: 한전 그리드 + 도시가스 발열량 → 기본값 상수, 후일 라이브러리화 가능
- 절감량 = (대체 그리드 전력 배출 + 대체 보일러 열 배출) − 연료전지 가스 배출

### 3c. 수익 / 요금 (revenue)

**산출**: `EnergyRevenueOutput`

- `lookupElectricityTariff(library, contract, month, loadType) → 원/kWh`
- `lookupGasTariff(library, season, usage) → 원/kWh`
- `calcMonthlyRevenue(production, tariffs) → EnergyRevenueRow[12]`
- 발전 수익 / 열생산 수익(가스 절감 환산) / 도시가스사용요금 / 최종수익

**확인 필요**: 계약종별, 시간대, 계절·하절/동절 구분 로직 — 라이브러리 구조 따라.

### 3d. LCOE & 경제성 (economics)

**산출**: `AnnualEconomicsOutput`, `EconomicsSummaryOutput`

함수:
- `calcLCOE({ capex, opexAnnual, productionAnnual, lifetime, discountRate }) → 원/kWh`
- `calcAnnualCashflow({ capex, revenue, opex, lifetime, escalation }) → AnnualEconomicsRow[N]`
- `calcNPV(cashflows, discountRate)`
- `calcIRR(cashflows)` — Newton-Raphson, 초기값 0.1
- `calcPayback(cashflows)` — 단순 + 할인
- `summarizeEconomics(rows, periods) → EconomicsSummaryOutput`

**필요 파라미터** (입력 스키마 확장 필요할 수 있음):
- 초기투자비 (설치비) — 세트 단가? 라이브러리?
- 연간 유지보수비율
- 할인율, 분석기간, 가스/전기 요금 상승률
- → Phase 3d 시작 전 사용자에게 명시 확인

---

## 3. 작업 순서 & 체크포인트

| # | 작업 | 산출 | 검증 |
|---|---|---|---|
| 3a-1 | 라이브러리에서 효율·발열량 위치 확인, 입력 스키마 보강 결정 | 결정 메모 | 사용자 컨펌 |
| 3a-2 | `calc/energy/production.ts` + 테스트 | 함수 + 4~6 케이스 | lint/test ✅ |
| 3a-3 | 커밋 | `Phase 3a: energy production calc` | — |
| 3b-1 | CO2 배출계수 결정 | 상수 모듈 | 사용자 컨펌 |
| 3b-2 | `calc/environment/co2.ts` + 테스트 | | ✅ |
| 3b-3 | 커밋 | | |
| 3c-1 | 요금 라이브러리 구조 분석 → tariff lookup 설계 | 메모 | 컨펌 |
| 3c-2 | `calc/revenue/*` + 테스트 | | ✅ |
| 3c-3 | 커밋 | | |
| 3d-1 | 경제성 입력 파라미터 확정 (capex, 할인율, 기간 등) | 입력 스키마 patch | 컨펌 |
| 3d-2 | `calc/economics/*` + 테스트 (NPV/IRR 손계산 비교) | | ✅ |
| 3d-3 | 커밋 + Phase 3 핸드오프 작성 | `PHASE3_HANDOFF.md` | |

---

## 4. 미해결/사용자 확인 항목 (3a 시작 전)

1. **연료전지 효율값** — 라이브러리 JSON에 발전효율/열효율 컬럼이 있는지, 아니면 정격 kW만 있는지?
2. **가스 사용량 산식** — 입력(전·열)으로부터 역산할지, 별도 효율 곡선이 있는지?
3. **계약용량_kW** 컬럼 — 입력 화면에 없음. 자동 계산(=총설치용량) 또는 별도 입력?
4. **CO2 배출계수** — 어떤 값 사용? (예: 한전 0.4567 kgCO2/kWh, 도시가스 56.1 kgCO2/GJ 등 출처 명시)
5. **경제성 파라미터** — 설치단가(원/kW), 할인율, 분석기간(15/20년?), 유지보수비율, 요금 상승률 — 디폴트값과 입력 가능 여부

→ 3a 착수 직전 위 5개 질문지로 한 번에 확인.

---

## 5. Phase 4 (UI) 분리 사유

- 계산 로직은 도메인 정확성 검증이 핵심 → UI 없이 Vitest로 빠르게 회귀 가능
- 출력 화면(탭2~)은 표/그래프 디자인 결정 필요 → 별도 호흡
- 계산 함수 안정화 후 UI에서는 단순 호출만 → 결합도 ↓
