# SECURITY.md — 보안 규칙

## API 키 관리
- Gemini API 키: 사용자가 앱 내에서 입력 → Supabase `settings` 테이블에 저장
- Supabase 키: `.env.local` 파일에만 저장, 절대 코드에 하드코딩 금지
- `.env` 파일은 `.gitignore`에 반드시 포함

## 환경변수
- `NEXT_PUBLIC_` 접두사가 붙은 변수만 클라이언트에 노출
- 민감한 키는 서버 사이드(API Route)에서만 접근

## Supabase 접근
- Row Level Security(RLS) 설정 (1인 사용이지만 기본 보안 유지)
- 서비스 키(service_role)는 서버 사이드에서만 사용

## 금지 사항
- API 키를 console.log에 출력하지 않는다
- API 키를 URL 파라미터로 전달하지 않는다
- 민감 정보를 Git에 커밋하지 않는다
