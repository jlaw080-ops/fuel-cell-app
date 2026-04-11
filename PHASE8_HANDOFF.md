# Phase 8 핸드오프 — 고급 분석 기능 3종

**작성일:** 2026-04-10  
**브랜치:** main  
**커밋 범위:** df3e714 → 3acbb5a

---

## 완료된 Phase

### Phase 8-1: 민감도 분석 (df3e714)

**목적:** 주요 변수를 ±10% / ±20% 변동시켰을 때 NPV·IRR·회수기간 변화 표시

**핵심 파일:**

- `src/lib/calc/sensitivity.ts` — 5개 변수 × 4개 시나리오 계산 (순수 함수)
- `src/components/results/SensitivityTable.tsx` — 컬러 히트맵 테이블 UI
- `src/components/results/ResultsSection.tsx` — 민감도 섹션 추가

**인터페이스:**

```typescript
// SensitivityInput = InverseCalcInput 와 동일한 구조
interface SensitivityInput {
  capex;
  baseElecRev;
  baseHeatRev;
  baseGasCost;
  baseMaint;
  maintenanceMode;
  lifetime;
  discountRate;
  electricityEscalation;
  gasEscalation;
  maintenanceEscalation;
}
```

---

### Phase 8-2: 리포트 비교 분석 (9261df9)

**목적:** 최대 4개 리포트를 나란히 비교, 최우수·최저값 강조

**핵심 파일:**

- `src/components/reports/CompareView.tsx` — 전면 재작성

**주요 설계:**

- 24개 데이터 행, 4개 섹션 (설비 정보 / 에너지 수익 / 경제성 / 분석 설정)
- NPV·IRR을 5/10/15/20년 시점별로 모두 표시
- `bestIndex()` / `worstIndex()` — 초록▲ / 빨강 강조
- 인쇄/PDF 버튼 포함

**진입점:** `/reports/compare?ids=a,b,c`

---

### Phase 8-3: 목표 IRR/회수기간 역산 (3acbb5a)

**목적:** 목표 지표를 입력하면 이진탐색으로 최대 CAPEX 또는 최소 발전수익 즉시 역산

**핵심 파일:**

- `src/lib/calc/inverse.ts` — 4가지 역산 함수
- `src/components/results/InverseCalcPanel.tsx` — 실시간 역산 UI
- `src/components/results/ResultsSection.tsx` — 민감도 분석 아래 새 섹션

**역산 조합 (2×2):**

| 목표 지표     | 역산 변수     | 함수                           |
| ------------- | ------------- | ------------------------------ |
| 목표 IRR      | 최대 CAPEX    | `solveCapexForTargetIrr`       |
| 목표 IRR      | 최소 발전수익 | `solveElecRevForTargetIrr`     |
| 목표 회수기간 | 최대 CAPEX    | `solveCapexForTargetPayback`   |
| 목표 회수기간 | 최소 발전수익 | `solveElecRevForTargetPayback` |

**알고리즘:** 이진탐색 (bisection), 최대 60회, 1원 정밀도, hi 동적 확장(최대 20배 2배씩)

**UI 결과 3가지 상태:**

- 초록: 현재 설정으로 이미 달성
- 빨강: 달성 불가 (null 반환)
- 파랑: 역산값 + 현재 대비 ±%

---

## 전체 아키텍처 현황

```
src/
├── lib/calc/
│   ├── economics/economics.ts   # IRR(Newton-Raphson), NPV, MaintenanceMode
│   ├── sensitivity.ts           # Phase 8-1 민감도
│   └── inverse.ts               # Phase 8-3 역산 (NEW)
│
├── components/results/
│   ├── ResultsSection.tsx       # 통합 결과 섹션 (메인 오케스트레이터)
│   ├── SensitivityTable.tsx     # Phase 8-1 UI
│   └── InverseCalcPanel.tsx     # Phase 8-3 UI (NEW)
│
└── components/reports/
    └── CompareView.tsx          # Phase 8-2 비교 (재작성)
```

**공통 입력 인터페이스** (`SensitivityInput` / `InverseCalcInput` 동일 구조):

```typescript
{
  (capex,
    baseElecRev,
    baseHeatRev,
    baseGasCost,
    baseMaint,
    maintenanceMode,
    lifetime,
    discountRate,
    electricityEscalation,
    gasEscalation,
    maintenanceEscalation);
}
```

---

## 다음 단계 후보 (Phase 9)

1. **PDF 리포트 완성도** — 역산 패널, 민감도 테이블을 PDF 출력에 포함
2. **다중 시나리오 저장** — 역산 결과를 별도 시나리오로 저장·비교
3. **토네이도 차트** — 민감도 분석을 시각화 (막대 차트, 변수별 영향도 크기 정렬)
4. **수익성 지도** — CAPEX × 발전단가 2D 히트맵으로 목표 달성 영역 시각화
5. **비교 PDF** — CompareView 인쇄 레이아웃 개선 (현재 기본 인쇄만 지원)
