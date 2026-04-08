# Phase 5 작업 인수인계 (Handoff) — 완료

> 작성일: 2026-04-08
> 세션: Claude Code (Opus 4.6)
> 작업 디렉토리: `c:/Users/jlaw8/dev/fuel-cell-app/`
> 이전 핸드오프: [PHASE3_HANDOFF.md](PHASE3_HANDOFF.md)

---

## 1. 세션 요약

Phase 3(계산 로직) → Phase 4(결과 UI) → **Phase 5(리포트 + 저장 + AI 검토)** 까지 한 흐름으로 완료. 수동 E2E 검증 완료(입력→결과→미리보기→저장→PDF 출력→AI 검토 표시).

---

## 2. Phase 5 산출물

### 5a. 데이터 영속화

| 파일                                                                                                       | 역할                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| [supabase/migrations/20260408000001_init_reports.sql](supabase/migrations/20260408000001_init_reports.sql) | `reports` 테이블 + anon RLS 정책. 대시보드 SQL Editor로 적용 완료                      |
| [src/lib/schemas/report.ts](src/lib/schemas/report.ts)                                                     | `reportSnapshotSchema` (zod, version: 1) — inputs/settings/results/meta 전체           |
| [src/lib/actions/reports.ts](src/lib/actions/reports.ts)                                                   | `saveReport` / `loadReport` / `saveAiReview` Server Actions                            |
| [src/lib/report/buildSnapshot.ts](src/lib/report/buildSnapshot.ts)                                         | `buildReportSnapshot` + `saveReportDraftLocal` / `loadReportDraftLocal` (localStorage) |

### 5b~c. 리포트 화면

| 파일                                                                                 | 역할                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| [src/app/report/page.tsx](src/app/report/page.tsx)                                   | Next.js 16 async `searchParams` + Suspense 라우트    |
| [src/app/report/report.css](src/app/report/report.css)                               | A4 portrait, `@page`, `@media print`, `.no-print`    |
| [src/components/report/ReportView.tsx](src/components/report/ReportView.tsx)         | id 또는 localStorage draft 로딩, AI 검토 자동 트리거 |
| [src/components/report/ReportDocument.tsx](src/components/report/ReportDocument.tsx) | 6페이지 본문 (표지/입력/에너지/수익/경제성/AI)       |

### 5d. ResultsSection 통합

[src/components/results/ResultsSection.tsx](src/components/results/ResultsSection.tsx) — `openReport(persist)` 함수 + 두 버튼:

- **미리보기**: localStorage에 저장 후 `/report` 이동
- **저장 + 리포트 보기**: Supabase에 저장 후 `/report?id=...` 이동

### 5e. AI 검토 (Gemini)

[src/lib/gemini/review.ts](src/lib/gemini/review.ts):

- 모델: `gemini-2.5-pro` (REST `v1beta`)
- 키 미설정 시 graceful skip (`{ ok:false, reason:'no_key' }`) — UI에 "기능 비활성화" 안내
- API 오류 시 응답 본문을 `console.error`로 Vercel 로그에 출력
- 프롬프트: 한국어 ~500자, 경제성 판단/리스크/개선방향

---

## 3. 환경 설정 (이미 적용 완료)

| 항목             | 위치                      | 상태                                   |
| ---------------- | ------------------------- | -------------------------------------- |
| `reports` 테이블 | Supabase 원격             | ✅ 대시보드에서 마이그레이션 실행 완료 |
| `GEMINI_API_KEY` | `.env.local` + Vercel env | ✅ 양쪽 모두 설정 완료                 |
| Vercel 자동 배포 | `main` 브랜치 push 트리거 | ✅ 동작 중                             |

---

## 4. 검증 결과 (수동 E2E)

| 단계                                    | 결과 |
| --------------------------------------- | ---- |
| 입력 → 결과 표시                        | ✅   |
| 미리보기 (localStorage)                 | ✅   |
| 저장 + 리포트 (Supabase row 생성)       | ✅   |
| AI 검토 의견 자동 생성 (gemini-2.5-pro) | ✅   |
| `window.print()` → A4 6페이지 PDF       | ✅   |

`npm run lint && npm run test (61/61) && npm run build` 모두 green.

---

## 5. 트러블슈팅 기록

| 증상                                             | 원인                                       | 해결                              |
| ------------------------------------------------ | ------------------------------------------ | --------------------------------- |
| 빌드 에러 `Export getServerClient doesn't exist` | server.ts의 실제 export는 `supabaseServer` | import 이름 교정                  |
| AI 검토 영구 비활성화                            | `gemini-2.0-flash` v1beta deprecated       | `gemini-2.5-pro`로 교체           |
| AI 검토 텍스트 도중 잘림                         | 2.5-flash thinking 토큰이 출력 토큰 잠식   | 2.5-pro + `maxOutputTokens: 4096` |
| Vitest "config" 일시적 에러                      | 알려진 flaky (path casing race)            | 재실행으로 해소                   |

---

## 6. 기술 부채 (다음 세션 정리 대상)

- [x] `vite-tsconfig-paths` deprecation 경고 → Vite 4가 native 지원, plugin 제거
- [x] `src/lib/calculations/.gitkeep` 빈 디렉토리 정리
- [ ] (Phase 6) shadcn/ui 도입 시 디자인 토큰 일관화
- [ ] (Phase 6) 리포트 차트 (월별 발전량/수익 막대) 추가 검토
- [ ] AI 검토 응답 캐싱/재생성 버튼

---

## 7. 다음 단계 후보 (Phase 6)

개발 지시서 미확정 항목:

1. **사용자 리포트 목록 화면** — `client_id` 기준 본인 리포트 리스트
2. **시나리오 비교** — 여러 리포트를 나란히 비교
3. **shadcn/ui 디자인 시스템 도입**
4. **리포트 차트** (recharts 등)
5. **인증** (현재 anon → Supabase Auth)

방향 결정 후 다음 세션 시작.

---

## 8. 주요 커밋

- `0083ffe` Phase 5: Report page + Supabase persistence + Gemini AI review
- `c6b223b` fix(gemini): use gemini-2.5-flash and log API error body
- `16476e3` fix(gemini): disable thinking and raise output tokens
- `25999a5` feat(gemini): switch to gemini-2.5-pro for deeper review
