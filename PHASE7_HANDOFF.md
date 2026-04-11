# Phase 7 작업 인수인계 (Handoff) — 완료

> 작성일: 2026-04-10
> 세션: Claude Code (Sonnet 4.6)
> 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
> 이전 핸드오프: [PHASE6_HANDOFF.md](PHASE6_HANDOFF.md)
> Production URL: https://fuel-cell-app.vercel.app

---

## 1. 세션 요약

Phase 6e-2 완료 검증 후 Phase 7 신규 기능 5개 + 차트 인쇄 버그픽스 완료 및 배포.

| 단계                                 | 내용                                                  | 상태 |
| ------------------------------------ | ----------------------------------------------------- | ---- |
| **6e-2 완료 검증**                   | Production E2E (저장·목록·Auth·ClaimBanner) 전부 통과 | ✅   |
| **7-1** 공유 URL (`is_public`)       | 리포트별 공개 ON/OFF + 링크 복사                      | ✅   |
| **7-2** AI 검토 재생성 + 입력 초기화 | AI regenerate 버튼 + 초기화 버튼                      | ✅   |
| **7-3** 공유 상태 목록 노출          | ReportsList에 공유 배지 + 토글 + 링크 복사            | ✅   |
| **7-4** 목록 검색/필터/정렬          | 제목 검색, 공유 중 필터, 5개 컬럼 정렬                | ✅   |
| **7-5** 차트 인쇄 최적화             | `isAnimationActive={false}` + 고정 px + print CSS     | ✅   |
| **7-5b** 차트 인쇄 버그픽스          | `overflow:auto` 래퍼 → Chrome SVG 렌더링 누락 수정    | ✅   |

---

## 2. Phase 7 상세 내용

### 7-1 — 공유 URL

**마이그레이션**: `supabase/migrations/20260409000003_reports_is_public.sql`

```sql
alter table reports add column if not exists is_public boolean not null default false;
-- anon/authenticated 공개 SELECT 정책 (is_public = true 인 row)
```

**Server Actions** (`src/lib/actions/reports.ts`):

- `setReportPublic(id, isPublic)` — 로그인 유저(owner)만 변경 가능
- `loadReport` 반환값에 `isPublic`, `isOwner` 추가
- `listReports` 반환 아이템에 `isPublic` 추가

**UI** (`src/components/report/ReportView.tsx`):

- 오너 전용: "공유 ON/OFF" 버튼, "링크 복사" 버튼
- `isPublic`, `isOwner`, `copied`, `sharePending` state

### 7-2 — AI 검토 재생성 + 입력 초기화

**AI 재생성** (`src/components/report/ReportView.tsx`):

- 오너 전용 "AI 검토 재생성" 버튼
- confirm() 후 `generateAiReview` → `saveAiReview` 덮어쓰기

**입력 초기화** (`src/components/tabs/InputScreen.tsx`):

- "초기화" 버튼 → `resetKey` 증가 → 자식 컴포넌트 remount (`key={...-${resetKey}}`)
- `skipRestore` 플래그로 서버 restore 방지
- reportId 있으면 `router.replace('/')` 호출

### 7-3 — 공유 상태 목록 노출

**ReportsList** (`src/components/reports/ReportsList.tsx`):

- 제목 옆 "공유 중" 배지 (파란 border)
- 액션 열에 "공유 ON/OFF" 토글, "링크 복사" 버튼
- `copiedId` state (2초 후 자동 초기화)
- `onTogglePublic(id, current)`, `onCopyLink(id)` 추가

### 7-4 — 목록 검색/필터/정렬

**ReportsList** 추가 state:

- `query` (제목 텍스트 검색)
- `publicOnly` (공유 중만 보기 체크박스)
- `sortKey: 'createdAt' | 'title' | 'capacity' | 'payback' | 'npv'`
- `sortDir: 'asc' | 'desc'`
- `displayItems` = `useMemo` 필터 + 정렬 파생

UI:

- 검색 input + "공유 중만 보기" 체크박스 + "필터 초기화"
- 클릭 가능한 컬럼 헤더 (저장일시/제목/총 용량/회수기간/20년 NPV)
- "N / M건" 카운트 표시

### 7-5 — 차트 인쇄 최적화

**근본 원인**: recharts 기본 `isAnimationActive={true}` → 브라우저 인쇄 시 애니메이션 초기 프레임(높이 0)에서 SVG가 캡처되어 막대/라인이 없는 빈 차트 출력.

**해결** (`src/components/charts/ReportCharts.tsx`):

- `ResponsiveContainer` 제거 → `width={640} height={260}` 고정 px 직접 전달
- 모든 `<Bar>`, `<Line>` 에 `isAnimationActive={false}` 추가

**Print CSS** (`src/app/report/report.css`):

- `.recharts-legend-wrapper` 절대위치 → 상대위치 재정의 (인쇄 시 범례가 카드 밖으로 튀어나오는 현상 방지)
- `print-color-adjust: exact` 유지

### 7-5b — 차트 인쇄 추가 버그픽스 (2026-04-10)

**근본 원인**: `ChartCard` 내부 `overflowX: 'auto'` 래퍼 → Chrome 인쇄 엔진이 `overflow: auto` 부모를 별도 컴포지팅 레이어로 처리하여 SVG 막대/라인을 PDF에 렌더링하지 않음. 결과적으로 범례만 출력되고 차트 본체가 공백으로 출력.

**해결**:

- `ChartCard` 래퍼에 `chart-scroll-wrapper` 클래스 추가 (`ReportCharts.tsx`)
- `@media print` 블록에 `.chart-scroll-wrapper { overflow: visible !important }` 추가 (`report.css`)
- Production 확인 완료 (2026-04-10)

---

## 3. 마이그레이션 목록 (Phase 6e-2 ~ 7)

| 파일                                      | 내용                                                           | 적용 상태 |
| ----------------------------------------- | -------------------------------------------------------------- | --------- |
| `20260408000003_reports_user_id.sql`      | user_id 컬럼 + RLS 8개                                         | ✅ 적용   |
| `20260409000001_reports_claim_policy.sql` | auth_claim_anon 정책 (SECURITY DEFINER RPC 도입 전 시도, 유지) | ✅ 적용   |
| `20260409000002_claim_anon_rpc.sql`       | `claim_anon_reports` SECURITY DEFINER RPC 함수                 | ✅ 적용   |
| `20260409000003_reports_is_public.sql`    | `is_public` 컬럼 + 공개 SELECT 정책 2개                        | ✅ 적용   |

---

## 4. 산출물 파일 목록

| 파일                                                       | Phase | 변경 내용                                                     |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `supabase/migrations/20260409000002_claim_anon_rpc.sql`    | 6e-2  | SECURITY DEFINER claim RPC                                    |
| `supabase/migrations/20260409000003_reports_is_public.sql` | 7-1   | is_public 컬럼                                                |
| `src/lib/actions/reports.ts`                               | 7-1   | setReportPublic, loadReport(isOwner), listReports(isPublic)   |
| `src/components/report/ReportView.tsx`                     | 7-1/2 | 공유 버튼, AI 재생성 버튼                                     |
| `src/components/tabs/InputScreen.tsx`                      | 7-2   | 초기화 버튼, resetKey, skipRestore                            |
| `src/components/reports/ReportsList.tsx`                   | 7-3/4 | 공유 배지/토글/링크복사, 검색/필터/정렬                       |
| `src/components/charts/ReportCharts.tsx`                   | 7-5/b | 고정 px, isAnimationActive=false, chart-scroll-wrapper 클래스 |
| `src/app/report/report.css`                                | 7-5/b | 범례 print CSS + chart-scroll-wrapper overflow fix            |

---

## 5. 검증 현황

| 기능                            | 검증 방법   | 결과 |
| ------------------------------- | ----------- | ---- |
| Production E2E (저장/목록/Auth) | 사용자 수동 | ✅   |
| ClaimBanner anon→user 흡수      | 사용자 수동 | ✅   |
| 공유 URL 생성/접근              | 사용자 수동 | ✅   |
| AI 검토 재생성                  | 사용자 수동 | ✅   |
| 입력 초기화                     | 사용자 수동 | ✅   |
| 목록 검색/필터/정렬             | 사용자 수동 | ✅   |
| 차트 인쇄 (PDF 저장)            | 사용자 수동 | ✅   |
| `lint + build`                  | CI          | ✅   |

---

## 6. 최종 커밋 목록 (Phase 7)

```
195ef86  fix(charts): fix SVG not rendering in print due to overflow:auto wrapper
6936f37  fix(charts): disable recharts animation for correct print/PDF output
062842e  fix(report): print-friendly chart sizing
e1c9426  feat(reports): search, filter, and sort in reports list
3172f56  feat(reports): surface share state in reports list
4ead582  feat: AI review regenerate button + input reset button
e99277c  feat(reports): shareable public report URLs
```

---

## 7. 다음 후보 (Phase 8)

우선순위 순:

| 후보                      | 내용                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| PDF 한국어 폰트 임베드    | 브라우저 `window.print()` 대신 서버사이드 PDF 생성 (puppeteer 등) |
| shadcn/ui 본격 적용       | 현 zinc 직접 스타일 → shadcn Button/Card/Table로 전환             |
| 이메일 리포트 발송        | Resend API로 PDF 첨부 메일 발송                                   |
| 민감도 분석 (Sensitivity) | 전기/가스 단가 ±% 변동 시 NPV/IRR 변화 테이블                     |
| REC 수익 모델 추가        | AI 검토에서 자주 언급 → 입력 항목 추가                            |

---

## 8. 기술 부채

- [ ] `forPrint` prop (deprecated로 표시) — 완전 제거 가능
- [ ] `ReportView.tsx` beforeprint resize dispatch — 고정 px 전환 후 불필요, 제거 가능
- [ ] Vitest config flaky — 무해, 재실행으로 해소
- [ ] shadcn primitive 6종 설치만 됨, 실사용 없음

---

## 9. 환경변수 전체

| 변수                            | 위치                | 용도                     |
| ------------------------------- | ------------------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | .env.local + Vercel | Supabase 프로젝트 URL    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env.local + Vercel | anon 키                  |
| `GEMINI_API_KEY`                | .env.local + Vercel | AI 검토 (gemini-2.5-pro) |
| `NEXT_PUBLIC_SITE_URL`          | .env.local + Vercel | Magic Link redirect base |
