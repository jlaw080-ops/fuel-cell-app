# RELIABILITY.md — 안정성 규칙

## CI 파이프라인 (GitHub Actions)

```
코드 push → ESLint 검사 → TypeScript 컴파일 → Vitest 실행 → 전체 통과 시 Vercel 배포
```

- 하나라도 실패하면 배포 차단
- 실패 내용은 `tech-debt-tracker.md`에 기록

## 프리커밋 훅 (Husky + lint-staged)

커밋 시 자동 실행:
1. ESLint --fix (자동 수정 가능한 것은 수정)
2. Prettier --write (코드 포맷팅)
3. 수정 후에도 에러가 남으면 커밋 차단

## 자동교정 루프

```
린터 실행 → 에러 발견 → AI가 직접 수정 → 린터 재실행 → (최대 3회 반복)
→ 3회 초과 시 tech-debt-tracker.md에 기록
```

## 가비지 컬렉션 실행 시점

- 새 기능 구현 완료 후
- 버그 수정 후
- 3개 이상 파일 수정 후
- 점검 항목:
  1. 미사용 import/변수/함수 제거
  2. 문서-코드 불일치 수정
  3. 에러 원인 → 린트 규칙 추가 + 테스트 추가
  4. CLADE.md 실패 기록 업데이트
