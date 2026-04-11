# Phase 11 핸드오프 — 비교 분석 강화 / 역산 UX / 모바일 반응형

**작성일:** 2026-04-11
**브랜치:** main
**커밋 범위:** 01e128f → 7503c2d (Phase 10 마지막 커밋 69b64c2 이후)

---

## 완료된 작업

### Task: 비교 분석 뷰 강화 (`/reports/compare`)

**커밋:** `01e128f`, `b110157`, `051cb4c`

**변경 파일:** `src/components/reports/CompareView.tsx`

| 커밋      | 추가 내용                                                                 |
| --------- | ------------------------------------------------------------------------- |
| `01e128f` | 승자 요약 카드(Winner Cards), SVG 막대 차트 (용량 / 회수기간 / NPV / IRR) |
| `b110157` | 음수 NPV 승자 빨간색 표시, 막대 차트 전체 제목 표시                       |
| `051cb4c` | 복합 순위(Composite Ranking) 카드, NPV 트렌드 선 그래프, IRR 막대 차트    |

**복합 순위 산정 방식:**

- 회수기간 역순위 + NPV 순위 + IRR 순위 합산
- null 값은 최하위 처리
- 동점 시 공동 순위

---

### Task B: 목표 역산 패널 UX 재설계

**커밋:** `aa23beb`

**변경 파일:** `src/components/results/InverseCalcPanel.tsx`

**변경 내용:**

- 첫 방문 사용자를 위한 안내 메시지 추가 ("계산 전 — 아래 버튼을 눌러 목표를 설정하세요")
- 발전수익 역산 결과 단위 표기 명확화 (월→연 혼동 방지)
- 레이아웃 정비

---

### Task C: PDF 리포트 헤더 코멘트 갱신

**커밋:** `0a89fc4`

**변경 파일:** `src/components/report/ReportDocument.tsx`

- 상단 JSDoc 섹션 목록을 현재 구조(8개 섹션)에 맞게 업데이트

---

### Task D: 모바일 반응형 개선

**커밋:** `7503c2d`

**변경 파일:**

- `src/app/page.tsx`
- `src/components/tabs/InputScreen.tsx`
- `src/components/inputs/FuelCellSetRow.tsx`
- `src/components/inputs/OperationProfileSelector.tsx`

**핵심 변경 패턴:**

```
grid grid-cols-12  →  flex flex-wrap / grid grid-cols-2 / grid grid-cols-4 sm:grid-cols-12
```

| 컴포넌트                   | 이전                                  | 이후                                                                          |
| -------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `FuelCellSetRow`           | `grid-cols-12` 단일 행                | 형식/제조사 2열 → 모델 full-width → 용량/수량/삭제 flex 3단 레이아웃          |
| `OperationProfileSelector` | `grid-cols-12`                        | 운전유형 flex-wrap, 월별 `grid-cols-4 sm:grid-cols-12`, 시간 입력 `flex-wrap` |
| `InputScreen`              | `flex items-baseline justify-between` | `flex flex-wrap items-start justify-between gap-2` + 버튼 `shrink-0`          |
| `page.tsx`                 | 고정 폰트 크기                        | `text-xl sm:text-2xl`, `px-4 sm:px-6`, `mb-4 sm:mb-6`                         |

---

## 추가 완료된 작업 (2026-04-11 후속 세션)

### Task E: 토네이도 차트 null 가드 버그 수정

**커밋:** `3c64236`

**변경 파일:** `src/components/results/ResultsSection.tsx`

**근본 원인:**

- 가스 요금 라이브러리에 해당 항목이 없으면 `lookupGasUnitPrice` → null
- 12개월 전체가 null → `sumRows()` → null 반환
- null 가드 5조건 (`capex`, `baseMaint`, `elecRev`, `heatRev`, `gasCost` 모두 비null) → 민감도 / 역산 / 수익성 지도 섹션 전체 차단

**수정 내용:**

- null 가드를 2조건으로 완화 (`capex != null && baseMaintFallback != null`)
- revenue null → `?? 0` 폴백 변수 선언 (`baseElecRevFallback`, `baseHeatRevFallback`, `baseGasCostFallback`)
- `hasPartialRevenue` 플래그로 amber 경고 배너 표시 (섹션 숨김 대신 경고로 안내)
- 4개 컴포넌트 입력을 폴백 변수로 교체

---

### Task F: 리포트 목록 `/reports` 모바일 반응형

**커밋:** `9b9a6b7`

**변경 파일:** `src/components/reports/ReportsList.tsx`

**변경 내용:**

- 모바일 (`< md`): 카드 레이아웃 신규 추가
  - 카드 헤더: 체크박스 + 제목(인라인 편집) + 날짜 + 공유 중 배지
  - 지표 그리드: 총 용량 / 회수기간 / NPV / IRR (2×2)
  - 액션 버튼: `flex-wrap`으로 자동 줄바꿈
  - 검색창: `w-full sm:w-64`
- 데스크탑 (`md+`): 기존 테이블 유지 + `overflow-x-auto` 래퍼
- 빈 필터 결과 메시지를 테이블 외부 별도 div로 분리

---

## 미구현 / 다음 세션 미해결 항목

_(이번 세션에서 Phase 11 이월 항목 모두 해결됨)_

---

## 현재 아키텍처 현황

```
src/
├── components/
│   ├── inputs/
│   │   ├── FuelCellSetRow.tsx        ← Phase 11 모바일 개선
│   │   ├── FuelCellSetList.tsx
│   │   └── OperationProfileSelector.tsx ← Phase 11 모바일 개선
│   ├── tabs/
│   │   └── InputScreen.tsx           ← Phase 11 모바일 개선
│   ├── results/
│   │   ├── ResultsSection.tsx        ← Task E: null 가드 버그 수정 완료
│   │   ├── TornadoChart.tsx          ← 순수 SVG
│   │   ├── InverseCalcPanel.tsx      ← Phase 11 UX 재설계
│   │   ├── SensitivityTable.tsx
│   │   └── ProfitabilityMap.tsx
│   ├── reports/
│   │   ├── ReportsList.tsx           ← Task F: 모바일 카드 레이아웃 추가
│   │   └── CompareView.tsx           ← Phase 11 강화
│   └── report/
│       └── ReportDocument.tsx        ← Phase 10 SVG 차트 삽입
└── lib/
    ├── calc/
    │   ├── economics/economics.ts
    │   ├── sensitivity.ts
    │   ├── inverse.ts
    │   └── profitabilityMap.ts
    └── actions/
        └── reports.ts                ← listReports, deleteReport, renameReport, setReportPublic
```

---

## Phase 12 목표 — shadcn/ui 본격 적용

### 배경

현재 모든 UI가 Tailwind CSS 직접 스타일링(zinc 팔레트). 일관성 있는 컴포넌트 시스템 도입이 목표.

### 적용 대상 우선순위

| 우선순위 | 컴포넌트                        | 현재            | 대상 shadcn |
| -------- | ------------------------------- | --------------- | ----------- |
| 1        | 저장 버튼, 삭제 버튼, 링크 버튼 | 직접 `<button>` | `Button`    |
| 2        | 섹션 카드                       | 직접 `<div>`    | `Card`      |
| 3        | 리포트 목록 테이블              | 직접 `<table>`  | `Table`     |
| 4        | 텍스트 입력, 숫자 입력          | 직접 `<input>`  | `Input`     |
| 5        | 드롭다운                        | 직접 `<select>` | `Select`    |

### 적용 전 확인 사항

```bash
# shadcn/ui 초기화 (이미 설치된 경우 skip)
npx shadcn@latest init

# 필요 컴포넌트 추가
npx shadcn@latest add button card table input select label badge
```

- `components.json` 설정 확인 (`baseColor`, `cssVariables`)
- 기존 Tailwind zinc 팔레트와 shadcn 테마 변수 충돌 여부 검토
- 점진적 교체 전략: 신규 컴포넌트부터 적용 → 기존 파일 점진적 마이그레이션

### 마이그레이션 시작 추천 파일

1. `InputScreen.tsx` — 저장 버튼 Button 전환
2. `ReportsList.tsx` — Table + Button 전환
3. `FuelCellSetRow.tsx` — Input + Select + Button 전환

---

## 브랜치 상태

- **브랜치:** `main`
- **최신 커밋:** `9b9a6b7`
- **미스테이지 파일:** `.claude/settings.local.json` (커밋 불필요)
- **배포:** Vercel 자동 배포 트리거됨 (push 완료)
