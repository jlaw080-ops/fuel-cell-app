# Phase 9 핸드오프 — 토네이도 차트 / 수익성 지도 / 미해결 버그

**작성일:** 2026-04-10  
**브랜치:** main  
**커밋 범위:** c6b8cb7 → b411b34

---

## 완료된 작업

### Phase 9-1: 토네이도 차트 (c6b8cb7 → 987297d)

**목적:** 민감도 분석 결과를 수평 막대 차트로 시각화 (영향도 큰 변수일수록 위에 배치)

**핵심 파일:**

- `src/components/results/TornadoChart.tsx` — 순수 SVG 구현

**구현 이력:**

- 초기 구현: recharts `BarChart` + `stackId="t"` + `fill="transparent"` 스페이서 패턴
- recharts v3.8.1에서 `fill="transparent"` + stacked bar + `radius` 조합이 완전히 렌더링 안 됨
- **1차 수정 (987297d)**: recharts 제거 → 순수 SVG `<rect>` 직접 계산으로 전면 재작성

**현재 SVG 설계:**

```
CHART_WIDTH=560, LABEL_W=80, BAR_H=24, BAR_GAP=10, AXIS_H=24, V_PAD=8
plotW = 480

각 행: toX(v) = (v - domainMin) / (domainMax - domainMin) * 480

왼쪽 세그먼트: low → base
  leftX = min(lowX, baseXRow)
  leftW = |baseXRow - lowX|
  → <rect x={LABEL_W + leftX} fill={lowerFill} />

오른쪽 세그먼트: base → high
  rightX = min(highX, baseXRow)
  rightW = |highX - baseXRow|
  → <rect x={LABEL_W + rightX} fill={upperFill} />

기준선: <line x1={LABEL_W + baseX} />  (baseX = toX(rows[0].base))
```

---

### Phase 9-2: 수익성 지도 — CAPEX × 발전수익 2D 히트맵 (84069de)

**목적:** CAPEX와 발전수익을 ±50% 범위로 변동시켰을 때 수익성 지표 변화를 2D 히트맵으로 표시

**핵심 파일:**

- `src/lib/calc/profitabilityMap.ts` — 11×11 그리드 계산
- `src/components/results/ProfitabilityMap.tsx` — SVG 히트맵 UI

**설계:**

- X축: 발전수익 배율 −50% ~ +50% (11단계)
- Y축: CAPEX 배율 −50% ~ +50% (11단계)
- 셀 색상: NPV/IRR/회수기간 중 선택된 지표에 따라 green/red 그라디언트
- 기준점(현재값) 강조 표시

---

## 미해결 버그: 토네이도 차트 여전히 미표시

### 증상

- 사용자 확인: `fix(sensitivity)` 커밋(b411b34) 이후에도 토네이도 차트가 화면에 나타나지 않음
- 민감도 분석 섹션(SensitivityTable, TornadoChart, InverseCalcPanel, ProfitabilityMap) 전체가 숨겨진 것으로 보임

### 지금까지 시도한 수정

| 커밋    | 수정 내용                                                           | 결과          |
| ------- | ------------------------------------------------------------------- | ------------- |
| 987297d | recharts → 순수 SVG 재작성                                          | 여전히 미표시 |
| b411b34 | null 가드에서 `baseAnnualMaintenance != null` 제거, ratio 폴백 추가 | 여전히 미표시 |

### null 가드 현재 조건 (`ResultsSection.tsx:219-223`)

```tsx
{computed.econ.capex != null &&
  baseMaintFallback != null &&                          // ← b411b34 에서 수정
  computed.revenue.합계.발전_월간총수익_원 != null &&
  computed.revenue.합계.열생산_월간총수익_원 != null &&
  computed.revenue.합계.도시가스사용요금_원 != null && (
    ... 민감도 분석 섹션 ...
  )}
```

`baseMaintFallback` 계산 (`ResultsSection.tsx:144-146`):

```tsx
const baseMaintFallback =
  computed.econ.baseAnnualMaintenance ??
  (computed.econ.capex != null ? computed.econ.capex * settings.maintenanceRatio : null);
```

### 남은 null 경로 가설 (우선순위 순)

#### 가설 A — 수익 합계값 null (가장 가능성 높음)

`revenue.ts`의 `sumRows`는 **모든 월 데이터 중 하나라도 null이 있으면** 해당 합계가 null이 됨.

null이 되는 조건:

- `발전_월간총수익_원`: 가스 타리프에 '연료전지전용' 항목이 없을 때
- `열생산_월간총수익_원`: 가스 타리프에 '일반용' 항목이 없을 때
- `도시가스사용요금_원`: fuelCellGasPrice null 또는 production.월간\_도시가스사용량\_kWh null

```
// revenue.ts:39
lookupGasUnitPrice(library, '연료전지전용')  → null if no match
lookupGasUnitPrice(library, '일반용')       → null if no match (substring 매칭)
```

**진단 방법:**
브라우저 DevTools Console에서:

```js
// /src/components/results/ResultsSection.tsx 에 임시 추가
console.log({
  capex: computed.econ.capex,
  baseAnnualMaintenance: computed.econ.baseAnnualMaintenance,
  baseMaintFallback,
  elecRev: computed.revenue.합계.발전_월간총수익_원,
  heatRev: computed.revenue.합계.열생산_월간총수익_원,
  gasCost: computed.revenue.합계.도시가스사용요금_원,
});
```

#### 가설 B — capex null

선택한 제품의 라이브러리에 `설치단가_원per_kW`가 null이면 `calcCapex` → null → `baseMaintFallback`도 null → 가드 실패.

`calcCapex`는 `economics.ts` 내부 함수. 제품 라이브러리의 `설치단가_원per_kW` 필드 확인 필요.

#### 가설 C — 섹션은 렌더링되나 SVG가 시각적으로 보이지 않음

- CSS overflow: hidden / clip 에 의한 클리핑
- SVG dimensions가 0
- 부모 요소의 height: 0

**진단 방법:** DevTools Elements 탭에서 `<section>` 과 `<svg>` 요소가 DOM에 존재하는지 확인.

### 권장 수정 방향

**단기 (null 가드 완전 제거):**
민감도 섹션을 `SensitivityTable`과 독립적으로 표시. revenue null인 경우에도 차트가 "데이터 없음" 상태를 보여주도록.

```tsx
// 현재 guard 조건을 완화하거나
// 각 컴포넌트에 fallback 처리를 위임
```

**근본 수정:**

1. `sumRows`가 일부 월 null이어도 유효한 월만 합산하도록 변경
2. `calcCapex`의 null 경로 추적 후 적절한 기본값 설정

---

## 전체 아키텍처 현황

```
src/
├── lib/calc/
│   ├── economics/economics.ts      # IRR, NPV, capex 계산
│   ├── sensitivity.ts              # 5변수 × 5시나리오 민감도
│   ├── inverse.ts                  # 목표 IRR/회수기간 역산
│   └── profitabilityMap.ts         # 2D 히트맵 계산 (Phase 9-2)
│
├── components/results/
│   ├── ResultsSection.tsx          # 통합 결과 오케스트레이터
│   ├── SensitivityTable.tsx        # 민감도 히트맵 테이블
│   ├── TornadoChart.tsx            # 순수 SVG 토네이도 차트 ← 미표시 버그
│   ├── InverseCalcPanel.tsx        # 역산 패널
│   └── ProfitabilityMap.tsx        # 수익성 지도 히트맵
│
└── components/reports/
    └── CompareView.tsx             # 리포트 비교
```

### null 가드 조건이 걸리는 모든 섹션 (ResultsSection.tsx)

동일한 조건 3곳:

- 민감도 분석 (lines 219–263): SensitivityTable + TornadoChart
- 목표 역산 (lines 265–293): InverseCalcPanel
- 수익성 지도 (lines 295–326): ProfitabilityMap

**세 섹션 모두 같은 조건으로 가드되므로, 조건이 false이면 전부 숨겨짐.**
분리 표시 여부도 검토 가능.

---

## 다음 세션 시작 시 우선 할 일

1. `ResultsSection.tsx` 에 임시 `console.log` 추가하여 어떤 값이 null인지 정확히 확인
2. null인 값을 추적하여 해당 계산 함수 수정
3. 토네이도 차트 정상 출력 확인 후 커밋
4. console.log 제거 후 최종 커밋
