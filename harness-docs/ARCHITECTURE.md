# ARCHITECTURE.md — 앱 전체 설계

## 프로젝트 개요

- **프로젝트명**: 연료전지 경제성 평가 앱
- **목적**: 연료전지 설치 시 에너지 생산량, 수익, 경제성을 자동 계산하고 리포트를 생성
- **사용자**: 1인 (로그인 없음)

---

## 기술 스택

| 항목 | 기술 | 용도 |
|------|------|------|
| 프레임워크 | Next.js 14+ (App Router) | 웹앱 기본 구조 |
| 언어 | TypeScript | 타입 안전성 |
| 스타일링 | Tailwind CSS | UI 스타일링 |
| DB | Supabase (PostgreSQL) | 데이터 저장/조회 |
| AI 검토 | Google Gemini API | 경제성 분석 의견 생성 |
| PDF | react-pdf 또는 jspdf | 리포트 PDF 생성 |
| 배포 | Vercel | 호스팅 |
| 린터 | ESLint + Prettier | 코드 품질 |
| 테스트 | Vitest | 단위 테스트 |
| VCS | GitHub | 버전 관리 |

---

## 앱 구조 (한 페이지 + 5개 탭)

```
[탭1: 입력] → [탭2: 에너지 계산] → [탭3: 경제성 평가] → [탭4: AI 검토] → [탭5: 리포트]
```

### 탭1: 입력 (Input)
- **Input1_연료전지정보**: 형식 → 제조사 → 모델명 선택 (라이브러리에서 호출), 설치수량 입력
- **Input2_운전시간정보**: 연간운전유형 선택 → 가동일 자동 호출, 일일 운전시간 입력
- 여러 세트(sets) 추가/삭제 가능

### 탭2: 에너지 계산 (Calculation)
- output1: 에너지 생산량 및 사용량 (전력, 열, 도시가스) — 월별 테이블
- 계산 수식은 `docs/product-specs/calculation-formulas.md` 참조

### 탭3: 경제성 평가 (Economics)
- output2: 에너지 생산 수익 (발전 수익, 열 수익, 가스 비용) — 월별 테이블
- output3: 연도별 경제성 평가 (순현금흐름, 누적현금흐름) — 연도별 테이블
- output4: 최종 평가 결과 (NPV, IRR, 투자회수기간 등)

### 탭4: AI 검토 (AI Review)
- Gemini API를 통한 경제성 분석 의견
- A4 한 페이지 이내 분량
- API 키 1회 입력 후 계속 사용 (로컬스토리지 또는 Supabase 저장)
- 작성지침 관리 기능

### 탭5: 리포트 (Report)
- Input과 Output을 목차별로 표시
- A4 세로형 포맷
- 화면 미리보기 + PDF 다운로드

---

## 데이터 흐름

```
[라이브러리 JSON] ──읽기──→ [Supabase DB]
                                  ↓
[사용자 입력] ──저장──→ [Supabase DB]
                                  ↓
                          [계산 엔진 (서버)]
                                  ↓
                    [결과 저장] → [Supabase DB]
                                  ↓
              [화면 표시] + [PDF 생성] + [AI 검토]
```

---

## 폴더 구조 (src/)

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 공통 레이아웃
│   ├── page.tsx            # 메인 페이지 (5탭 구조)
│   └── api/                # API 라우트
│       ├── calculate/      # 계산 API
│       ├── gemini/         # Gemini AI 검토 API
│       └── report/         # PDF 생성 API
├── components/             # UI 컴포넌트
│   ├── tabs/               # 탭별 컴포넌트
│   │   ├── InputTab.tsx
│   │   ├── CalculationTab.tsx
│   │   ├── EconomicsTab.tsx
│   │   ├── AIReviewTab.tsx
│   │   └── ReportTab.tsx
│   ├── ui/                 # 공통 UI (버튼, 테이블 등)
│   └── layout/             # 레이아웃 컴포넌트
├── lib/                    # 유틸리티
│   ├── calculations/       # 계산 로직 (수식 구현)
│   ├── supabase/           # Supabase 클라이언트
│   ├── gemini/             # Gemini API 클라이언트
│   └── pdf/                # PDF 생성 로직
├── types/                  # TypeScript 타입 정의
├── data/                   # 라이브러리 JSON 파일
│   ├── 연료전지제품라이브러리.json
│   ├── 월별가동일라이브러리.json
│   ├── 전기요금라이브러리.json
│   └── 가스요금라이브러리.json
└── styles/                 # 글로벌 스타일
```

---

## Supabase 테이블 구조

상세 스키마는 `docs/generated/db-schema.md` 참조

### 주요 테이블
- `projects`: 프로젝트 정보 (이름, 생성일)
- `fuel_cell_inputs`: 연료전지 입력 데이터
- `operation_inputs`: 운전시간 입력 데이터
- `calculation_results`: 계산 결과
- `economic_results`: 경제성 평가 결과
- `ai_reviews`: AI 검토 결과
- `settings`: 설정 (Gemini API 키, 작성지침 등)

---

## 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=       # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase 공개 키
```

> Gemini API 키는 환경변수가 아닌 Supabase settings 테이블에 저장 (사용자가 앱 내에서 입력)
