# Phase 1 작업 인수인계 (Handoff)

> 작성일: 2026-04-07
> 작업 세션: Claude Code (Opus 4.6)
> 원본 위치: `c:\Users\jlaw8\ENERGINNO Dropbox\KIM JEEHEON\01 업무관련\00_AI 관련 업무\개인업무 자동화\연료전기경제성검토2\`
> 신규 작업 위치: `c:\Users\jlaw8\dev\fuel-cell-app\`

---

## 1. 작업 요청 배경

사용자 지시: "@harness-docs/CLADE.md 를 읽고 phase1-setup.md를 실행해줘"

대상 파일: `harness-docs/docs/exec-plans/active/phase1-setup.md`

### Phase 1 원본 작업 목록

- [x] Next.js + TypeScript 프로젝트 생성
- [x] ESLint + Prettier 설정
- [x] Husky + lint-staged 설정 (프리커밋 훅)
- [x] Vitest 설정
- [ ] Supabase 프로젝트 연결 ← **보류 (사용자 키 필요)**
- [x] 폴더 구조 생성 (ARCHITECTURE.md 기준)
- [x] 라이브러리 JSON 파일 배치 (`src/data/`)
- [x] TypeScript 타입 정의 (`src/types/`)
- [x] CI 파이프라인 설정 (GitHub Actions)
- [ ] Vercel 배포 연결 ← **보류 (GitHub remote 선행)**

---

## 2. 위치 이전 사유 (Dropbox → 로컬)

**문제**: 원본 디렉토리(Dropbox 동기화 폴더 + 한글 경로)에서 `create-next-app` 실행 시 두 가지 에러 발생.

1. `name can only contain URL-friendly characters` — 한글 디렉토리명이 npm 패키지명 규칙 위반
2. `EBUSY: resource busy or locked, rename '...\fuel-cell-app\app' -> '...\src\app'` — Dropbox 파일 락이 create-next-app의 폴더 이동을 차단

**해결**: 사용자 승인 후 옵션 A 채택 → `c:/Users/jlaw8/dev/fuel-cell-app/`에 신규 생성하고 `harness-docs/`만 복사.

> Dropbox 원본은 보존됨 (스펙 백업용).

---

## 3. 최종 스택 (계획 대비 변경점)

| 항목          | 계획                | 실제                                     |
| ------------- | ------------------- | ---------------------------------------- |
| Next.js       | 14+                 | **16.2.2** (Turbopack, App Router)       |
| React         | 19                  | 19.2.4                                   |
| ESLint        | v8 + .eslintrc.json | **v9 flat config** (`eslint.config.mjs`) |
| Tailwind      | v3 추정             | **v4** (CSS 기반 설정)                   |
| TypeScript    | 5                   | 5                                        |
| 테스트        | Vitest              | Vitest 4.1.2                             |
| 패키지 매니저 | npm                 | npm 11.11.0 / Node 25.8.0                |

ARCHITECTURE.md의 명시 스택과는 메이저 버전이 다르지만 (Next 14 → 16, Tailwind 3 → 4), create-next-app 최신 기준을 우선 적용. 필요 시 다운그레이드 가능.

---

## 4. 생성·설정한 파일 전체 목록

### 4.1 프로젝트 골격 (create-next-app)

- `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`
- `postcss.config.mjs`, `eslint.config.mjs`
- `src/app/{layout.tsx,page.tsx,globals.css,favicon.ico}`
- `public/*.svg`

### 4.2 추가 의존성 (npm i)

**dependencies**

- `@supabase/supabase-js`

**devDependencies**

- `prettier`, `eslint-config-prettier`
- `husky`, `lint-staged`
- `vitest`, `@vitest/ui`, `@vitejs/plugin-react`, `vite-tsconfig-paths`
- `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`

### 4.3 도구 설정 파일 (신규)

| 파일                       | 내용                                                     |
| -------------------------- | -------------------------------------------------------- |
| `.prettierrc`              | semi, singleQuote, printWidth 100, trailingComma all     |
| `.prettierignore`          | .next, node_modules, harness-docs, src/data/\*.json 등   |
| `eslint.config.mjs`        | 기존 + `eslint-config-prettier` 추가 + harness-docs 무시 |
| `vitest.config.ts`         | jsdom 환경, React plugin, setup 파일                     |
| `src/test/setup.ts`        | `@testing-library/jest-dom/vitest` import                |
| `.husky/pre-commit`        | `npx lint-staged`                                        |
| `.env.local.example`       | Supabase URL/anon key placeholder                        |
| `.github/workflows/ci.yml` | npm ci → lint → format:check → test → build              |

### 4.4 package.json 스크립트 추가

```json
"lint": "eslint",
"lint:fix": "eslint --fix",
"format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md,css}\"",
"format:check": "prettier --check ...",
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"prepare": "husky"
```

`lint-staged` 블록:

```json
"*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
"*.{json,md,css}": ["prettier --write"]
```

### 4.5 폴더 구조 (ARCHITECTURE.md 기준)

```
src/
├── app/
│   ├── api/{calculate,gemini,report}/
│   └── (기존 layout/page)
├── components/{tabs,ui,layout}/
├── lib/
│   ├── calculations/
│   ├── supabase/
│   ├── gemini/
│   ├── pdf/
│   └── __tests__/sanity.test.ts
├── types/{fuelCell,operation,tariff,inputs,outputs,index}.ts
├── data/  ← 라이브러리 JSON 4종
├── styles/
└── test/setup.ts
```

### 4.6 라이브러리 JSON 배치 (`src/data/`)

- `연료전지제품라이브러리.json`
- `월별가동일라이브러리.json`
- `전기요금라이브러리.json`
- `가스요금라이브러리.json`

> CLADE.md 금지 조항 준수 — JSON 키/구조 변경 없이 복사만.

### 4.7 TypeScript 타입 정의 (`src/types/`)

**`fuelCell.ts`** — 연료전지 제품 라이브러리

- `FuelCellType = 'PEMFC' | 'SOFC' | 'PAFC'`
- `FuelCellProduct` — 형식, 제조사, 모델명, 정격발전용량\_kW, 열생산용량\_kW, 가스소비량\_kW, 발전효율, 열회수효율, kW당설치단가, kW당연간유지비용 (대부분 nullable)
- `FuelCellLibrary = FuelCellProduct[]`

**`operation.ts`** — 월별 가동일 라이브러리

- `OperationProfileKey = '365일가동' | '주말일부가동' | '평일가동' | '학기중가동'`
- `OperationProfile { 연간가동일, 월별가동일: number[] }` (길이 12)

**`tariff.ts`** — 전기/가스 요금

- `ElectricityTariffLibrary { 요금제, 기본요금_원per_kW, 단위, 데이터: ElectricityTariffRow[] }`
- `ElectricityTariffRow { 월, 경부하, 중간부하, 최대부하 }`
- `GasTariffEntry { 구분, 단가_원per_kW }`

**`inputs.ts`** — Input1, Input2

- `FuelCellInputSet`, `FuelCellInput { sets, 총설치용량_kW }`
- `OperationInput { 연간운전유형, 연간운전일수, 일일_중간부하_운전시간, 일일_최대부하_운전시간 }`

**`outputs.ts`** — output1~4

- `EnergyProductionOutput` (월별 12행 + 합계)
- `EnergyRevenueOutput` (월별 12행 + 합계)
- `AnnualEconomicsOutput` (연도별 0~20)
- `EconomicsSummaryOutput` (5/10/15/20년 ROI/NPV/IRR)

**`index.ts`** — re-export

---

## 5. 검증 결과

| 명령             | 결과                             |
| ---------------- | -------------------------------- |
| `npm run format` | ✅ 통과                          |
| `npm run lint`   | ✅ 에러 0                        |
| `npm run test`   | ✅ 1/1 (sanity.test.ts)          |
| `npm run build`  | ✅ Next.js 16.2.2 정적 빌드 성공 |

**알려진 경고**

- `vite-tsconfig-paths`가 deprecation 경고. Vite는 이제 `resolve.tsconfigPaths: true`로 네이티브 지원. 추후 `vitest.config.ts`에서 플러그인 제거 가능 (현재 동작 무문제).

---

## 6. Phase 1 보류 항목 (사용자 입력 필요)

| 항목              | 필요한 정보                                                                      |
| ----------------- | -------------------------------------------------------------------------------- |
| **Supabase 연결** | 프로젝트 URL, anon key (또는 새 프로젝트 생성 후 알려주기)                       |
| **GitHub remote** | 리포 URL (현재 로컬 git만 init된 상태)                                           |
| **Vercel 배포**   | GitHub 연결 선행. 리포 푸시 후 Vercel 대시보드 또는 `deploy-to-vercel` 스킬 사용 |

---

## 7. 다음 작업 시작 시 체크리스트

1. 작업 디렉토리: **`c:/Users/jlaw8/dev/fuel-cell-app/`** (Dropbox 아님!)
2. `git status` — `harness-docs/` 등 신규 파일 존재. 아직 커밋 전.
3. Phase 2 진입 전 Phase 1 보류 항목(Supabase/GitHub/Vercel) 처리 또는 명시적 스킵 결정 필요.
4. ARCHITECTURE.md 위치: `harness-docs/ARCHITECTURE.md`
5. Phase 계획 위치: `harness-docs/docs/exec-plans/active/`

---

## 8. 대화 요약 (시간순)

1. 사용자가 CLADE.md 읽고 phase1-setup.md 실행 요청
2. Claude가 phase1-setup.md 확인 → 외부 연동(Supabase/Vercel/GitHub) 분리 제안
3. 사용자: "로컬까지 먼저 진행해줘"
4. Plan mode 진입 → 11단계 세부 계획 작성 → 사용자 승인
5. `create-next-app` 1차 실패 (한글 디렉토리명)
6. `_init/` 서브폴더 우회 시도 → Dropbox EBUSY 락 발생
7. Claude가 3가지 옵션(A: 외부 이전, B: 선택적 동기화, C: 일시정지) 제시
8. 사용자: "A로 진행해줘"
9. `c:/Users/jlaw8/dev/fuel-cell-app/`에 신규 생성 성공
10. harness-docs 복사 → 의존성 설치 → 도구 설정 → 폴더 구조 → JSON 복사 → 타입 정의 → CI 작성 → 검증 (lint/format/test/build 전부 통과)
11. 사용자가 본 핸드오프 문서 작성 요청

---

## 9. 참고 명령어 (다음 세션용)

```bash
cd /c/Users/jlaw8/dev/fuel-cell-app

# 개발 서버
npm run dev

# 검증
npm run lint
npm run format:check
npm run test
npm run build

# Husky 프리커밋 훅 동작 확인 (커밋 시 자동)
git add . && git commit -m "test"
```
