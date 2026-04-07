# FRONTEND.md — 프론트엔드 규칙

## 기술 구성
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- React Server Components 우선, 필요 시 Client Components 사용

## 컴포넌트 규칙
- 파일 1개 = 컴포넌트 1개
- 컴포넌트명은 PascalCase (예: `InputTab.tsx`)
- Props는 반드시 타입 정의 (interface 사용)
- `any` 타입 절대 금지

## 상태 관리
- 탭 간 공유 데이터: React Context 또는 Zustand
- 서버 데이터: Supabase 직접 호출 (TanStack Query 권장)
- 폼 상태: React Hook Form 권장

## 파일 네이밍
- 컴포넌트: `PascalCase.tsx`
- 유틸리티: `camelCase.ts`
- 타입: `types.ts` 또는 `모듈명.types.ts`
- 테스트: `파일명.test.ts`

## 금지 사항
- `console.log`를 프로덕션 코드에 남기지 않는다
- 인라인 스타일 사용 금지 (Tailwind 클래스 사용)
- 하드코딩된 문자열 금지 (상수 파일로 분리)
