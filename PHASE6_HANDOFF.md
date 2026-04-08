# Phase 6 작업 인수인계 (Handoff) — 진행 중

> 작성일: 2026-04-08
> 세션: Claude Code (Opus 4.6)
> 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
> 이전 핸드오프: [PHASE5_HANDOFF.md](PHASE5_HANDOFF.md)

---

## 1. 세션 요약

Phase 6 후보 5개 중 **4개 완료** (1·2·3·4) + **1개 인프라만 완료** (5 = 6e-1).
Phase 6e-2(Auth 적용)는 다음 세션에서 진행.

| 단계                                 | 내용                                                | 상태        | 커밋      |
| ------------------------------------ | --------------------------------------------------- | ----------- | --------- |
| **6a** 리포트 목록 + 앱으로 불러오기 | `/reports` 페이지, `?reportId=`로 입력 화면 복원    | ✅          | `53e8f87` |
| **6a+** 제목 + 인라인 rename         | reports.title 컬럼, 클릭 편집                       | ✅          | `4470f68` |
| **6b** 차트 (recharts)               | 월별 발전/수익 막대 + 20년 누적 라인                | ✅          | `d29adb0` |
| **6c** 시나리오 비교                 | `/reports/compare?ids=...`, 체크박스 선택           | ✅          | `d29adb0` |
| **6d** shadcn/ui 도입                | install + 6 primitive (사용 보류)                   | ✅          | `4fc0ad7` |
| **6e-1** Auth 인프라                 | Magic Link, RLS 갱신, 미들웨어                      | ✅          | `fb84fa0` |
| **6e-2** Auth 적용                   | saveReport/listReports user_id 연동, anon→user 흡수 | ⏸ 다음 세션 | —         |

---

## 2. 다음 세션의 시작점 = 사용자 검증

### 2-1. 마이그레이션 적용 확인

| 마이그레이션                         | 적용 상태                                    |
| ------------------------------------ | -------------------------------------------- |
| `20260408000002_reports_title.sql`   | ✅ 적용 완료                                 |
| `20260408000003_reports_user_id.sql` | ⏳ 사용자 적용 진행 중 (이번 세션 종료 시점) |

다음 세션 시작 시:

1. Supabase 대시보드 → SQL Editor → `20260408000003` 적용 여부 재확인
2. 미적용이면 먼저 적용 (대시보드 SQL Editor → New query → 파일 내용 붙여넣기 → Run)

### 2-2. 환경변수 확인

| 환경              | 변수                                               | 적용 상태         |
| ----------------- | -------------------------------------------------- | ----------------- |
| 로컬 `.env.local` | `NEXT_PUBLIC_SITE_URL=http://localhost:3000`       | ⏳ 사용자 적용 중 |
| Vercel            | `NEXT_PUBLIC_SITE_URL=https://<production-domain>` | ⏳ 사용자 적용 중 |

> 적용 후 로컬은 `npm run dev` 재시작 필수.

### 2-3. Supabase Auth 설정 확인

Authentication → URL Configuration:

- Site URL: production 도메인
- Redirect URLs: `https://<prod>/auth/callback` + `http://localhost:3000/auth/callback`

Authentication → Providers → Email:

- Enable Email provider: ON
- Confirm email: OFF (Magic Link만 쓰므로)

### 2-4. Magic Link E2E 검증 (다음 세션 첫 작업)

1. **로컬**:
   - `npm run dev`
   - http://localhost:3000/auth → 본인 이메일 입력 → "로그인 링크 받기"
   - 메일함 → 링크 클릭 → http://localhost:3000/ 로 복귀
   - 우상단에 본인 이메일 + "로그아웃" 표시 확인
2. **배포**: 동일 흐름을 production URL에서 확인

검증 통과 시 → Phase 6e-2 시작.
실패 시 → 트러블슈팅 (Auth Logs, Redirect URLs, Site URL 재점검).

---

## 3. Phase 6 산출물 (파일별)

### 6a — 리포트 목록 + 불러오기

| 파일                                                                                                         | 역할                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [supabase/migrations/20260408000002_reports_title.sql](supabase/migrations/20260408000002_reports_title.sql) | reports.title 컬럼                                            |
| [src/lib/actions/reports.ts](src/lib/actions/reports.ts)                                                     | listReports / deleteReport / renameReport / saveReport(title) |
| [src/app/reports/page.tsx](src/app/reports/page.tsx)                                                         | 목록 라우트                                                   |
| [src/components/reports/ReportsList.tsx](src/components/reports/ReportsList.tsx)                             | 테이블 + 인라인 rename + 체크박스                             |
| [src/components/tabs/InputScreen.tsx](src/components/tabs/InputScreen.tsx)                                   | reportId prop, initialFuelCell/operation/settings/title 복원  |
| [src/components/results/ResultsSection.tsx](src/components/results/ResultsSection.tsx)                       | initialSettings + initialTitle prop, title input              |

### 6b — 차트

| 파일                                                                                   | 역할                                |
| -------------------------------------------------------------------------------------- | ----------------------------------- |
| [src/components/charts/ReportCharts.tsx](src/components/charts/ReportCharts.tsx)       | 월별 발전/수익 막대, 20년 누적 라인 |
| `package.json`                                                                         | recharts 추가                       |
| [src/components/report/ReportDocument.tsx](src/components/report/ReportDocument.tsx)   | 5페이지 시각화 섹션                 |
| [src/components/results/ResultsSection.tsx](src/components/results/ResultsSection.tsx) | 결과 화면에도 동일 차트             |

### 6c — 시나리오 비교

| 파일                                                                             | 역할                       |
| -------------------------------------------------------------------------------- | -------------------------- |
| [src/app/reports/compare/page.tsx](src/app/reports/compare/page.tsx)             | 비교 라우트 (`?ids=a,b,c`) |
| [src/components/reports/CompareView.tsx](src/components/reports/CompareView.tsx) | 10개 핵심지표 나란히 표    |

### 6d — shadcn/ui (install only)

| 파일                                                           | 역할                              |
| -------------------------------------------------------------- | --------------------------------- |
| `components.json`                                              | shadcn 설정 (radix base, neutral) |
| [src/lib/utils.ts](src/lib/utils.ts)                           | cn() 헬퍼                         |
| `src/components/ui/{button,input,card,table,dialog,label}.tsx` | primitive 6종                     |
| [src/app/globals.css](src/app/globals.css)                     | CSS variables 추가                |

> 기존 화면은 zinc 톤 그대로. Phase 7+ 신규 화면부터 점진 적용.

### 6e-1 — Auth 인프라

| 파일                                                                                                             | 역할                                             |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [supabase/migrations/20260408000003_reports_user_id.sql](supabase/migrations/20260408000003_reports_user_id.sql) | user_id 컬럼 + RLS 8개 (anon/authenticated 분리) |
| [src/middleware.ts](src/middleware.ts)                                                                           | 세션 자동 갱신                                   |
| [src/lib/supabase/browser.ts](src/lib/supabase/browser.ts)                                                       | createBrowserClient                              |
| [src/lib/supabase/serverWithAuth.ts](src/lib/supabase/serverWithAuth.ts)                                         | createServerClient (cookies 기반)                |
| [src/lib/actions/auth.ts](src/lib/actions/auth.ts)                                                               | signInWithMagicLink / signOut / getCurrentUser   |
| [src/app/auth/page.tsx](src/app/auth/page.tsx)                                                                   | 로그인 페이지                                    |
| [src/app/auth/callback/route.ts](src/app/auth/callback/route.ts)                                                 | 콜백 핸들러                                      |
| [src/components/auth/AuthForm.tsx](src/components/auth/AuthForm.tsx)                                             | 폼 (useTransition)                               |
| [src/app/page.tsx](src/app/page.tsx)                                                                             | 헤더에 로그인 상태 표시                          |

> 기존 `src/lib/supabase/server.ts` (`supabaseServer`)는 그대로 유지. anon 키만 사용 → 6e-2 작업 시 `serverWithAuth` 와 사용 분리 필요.

---

## 4. 검증 결과 (지금까지)

| 단계  | 검증                                                      |
| ----- | --------------------------------------------------------- |
| 6a    | ✅ 사용자 수동 E2E (저장→목록→불러오기→재저장)            |
| 6a+   | ✅ 사용자 수동 E2E (제목 입력 + 인라인 rename)            |
| 6b/6c | 빌드만 통과, 사용자 시각 검증 미진행 (다음 세션에서 함께) |
| 6d    | 빌드만 통과 (사용 안 하므로 시각 검증 불필요)             |
| 6e-1  | 빌드 통과, **E2E는 다음 세션 첫 작업**                    |

`npm run lint && test (61/61) && build` 모두 green (전 단계 공통).

---

## 5. Phase 6e-2 작업 계획 (다음 세션)

검증 통과 후 시작:

1. **`saveReport` 분기**:
   - 로그인 상태면 `serverWithAuth` 클라이언트 사용 → user_id 자동 기록 (RLS가 검증)
   - 비로그인이면 기존 anon 흐름 유지 (client_id만)

2. **`listReports` 분기**:
   - 로그인 시 `where user_id = auth.uid()` (RLS가 자동 처리)
   - 비로그인 시 기존 `where client_id = ?`

3. **anon → user 흡수 server action**:
   - 첫 로그인 직후 호출: `claimAnonReports(clientId)`
   - 동작: `update reports set user_id = auth.uid() where user_id is null and client_id = $1`
   - 흡수된 건수를 헤더 배너로 안내

4. **헤더에 흡수 결과 표시**:
   - 로그인 직후 1회 노출: "기존 N건의 임시 리포트를 계정으로 이전했습니다"

5. **deleteReport / renameReport**:
   - serverWithAuth 사용으로 교체 (RLS가 알아서 본인 row만 허용)

### 잠재 이슈

- `loadReport(id)` 는 누가 호출하든 동작해야 함:
  - anon row → anon 정책으로 SELECT 허용
  - 본인 user row → authenticated 정책
  - **타인 user row → 차단됨** (현재 정책상 의도된 동작)
- "공유 가능한 리포트 URL" 요구사항 생기면 별도 `is_public boolean` 컬럼 + 정책 추가 필요 (Phase 7+)

---

## 6. 기술 부채 / 후속 과제

- [ ] (Phase 6e-2) Auth 적용 + anon 흡수
- [ ] (Phase 7) shadcn 본격 적용 (전면 리팩토링은 디자인 토큰 결정 후)
- [ ] (Phase 7) 차트 인쇄 시 SVG 크기 최적화 (현재 ResponsiveContainer가 인쇄 폭 자동 산정 OK)
- [ ] (Phase 7) 리포트 영구 공유 URL (`is_public`)
- [ ] AI 검토 재생성 버튼
- [ ] PDF 한국어 폰트 임베드 검증 (현재 시스템 폰트 의존)
- [ ] Vitest "config" 일시 flaky — 무해, 재실행으로 해소

---

## 7. 환경변수 전체 (참고)

| 변수                            | 위치                | 용도                                       |
| ------------------------------- | ------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | .env.local + Vercel | Supabase 프로젝트 URL                      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env.local + Vercel | anon 키                                    |
| `GEMINI_API_KEY`                | .env.local + Vercel | AI 검토 (gemini-2.5-pro)                   |
| `NEXT_PUBLIC_SITE_URL`          | .env.local + Vercel | Magic Link redirect base (Phase 6e-1 신규) |

---

## 8. 주요 커밋 (Phase 6 전체)

- `53e8f87` Phase 6: Reports list + load snapshot back into app
- `4470f68` feat(reports): title field with inline rename
- `d29adb0` Phase 6b/c: Charts (recharts) + scenario comparison
- `4fc0ad7` chore: install shadcn/ui (radix base) + core primitives
- `fb84fa0` Phase 6e-1: Supabase Auth (Magic Link) infrastructure
