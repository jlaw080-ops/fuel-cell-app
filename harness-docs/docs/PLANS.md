# PLANS.md — 실행 로드맵

## Phase 1: 프로젝트 세팅
- 개발 환경 구축 (Next.js, ESLint, Prettier, Husky, Vitest)
- Supabase 연결, GitHub/Vercel 배포 파이프라인
- 상세: `docs/exec-plans/active/phase1-setup.md`

## Phase 2: 입력 화면 (탭1)
- 라이브러리 JSON 로딩 및 드롭다운 연결
- 연료전지 세트 추가/삭제 UI
- 운전시간 입력 UI
- Supabase 저장/불러오기

## Phase 3: 계산 엔진 (탭2)
- 수식 (1)~(3) 구현 및 테스트
- 월별 결과 테이블 UI

## Phase 4: 경제성 평가 (탭3)
- 수식 (4)~(7) 구현 및 테스트
- 연도별 경제성 계산 (output3, output4)
- 결과 테이블 및 차트 UI

## Phase 5: AI 검토 (탭4)
- Gemini API 연동
- API 키 관리 기능
- 작성지침 관리 기능
- 검토 결과 표시 UI

## Phase 6: 리포트 (탭5)
- 리포트 미리보기 UI (A4 세로형)
- PDF 생성 및 다운로드
- 목차, 표, 디자인 적용

## Phase 7: 디자인 완성
- ui-ux-pro-max 스킬 적용
- 전체 UI 다듬기, 반응형 점검
