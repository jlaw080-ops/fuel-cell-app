/**
 * 클라이언트 세션 식별자.
 *
 * 인증 없이 사용자별 입력을 구분하기 위한 임시 ID. localStorage에 UUID를
 * 저장하고, 모든 입력 row의 client_id 컬럼에 사용한다.
 *
 * Phase 5/6에서 Supabase Auth 도입 시 user_id로 마이그레이션 예정.
 *
 * 보안: 사용자가 변조 가능하므로 민감 데이터 식별자로 사용 금지.
 */
const STORAGE_KEY = 'fc-app-client-id';

export function getClientId(): string {
  if (typeof window === 'undefined') return '';
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** 테스트/디버깅용. 일반 사용처에서는 호출하지 말 것. */
export function resetClientId(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
