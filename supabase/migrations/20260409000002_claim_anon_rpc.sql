-- Phase 7 (6e-2 잔여) — ClaimBanner production 이슈 수정.
--
-- 문제: authenticated role 의 SELECT 정책(auth_select_own)이 user_id = auth.uid()
-- 이라, user_id IS NULL 인 anon row 는 authenticated 에서 "보이지" 않음.
-- Postgres RLS 는 UPDATE 를 허용하기 위해 해당 row 가 SELECT 에도 매치되어야 하므로
-- claim 용 UPDATE 가 조용히 0건을 반환했음.
--
-- SELECT 정책을 넓히면 타 사용자의 anon row 노출 위험. 대신 SECURITY DEFINER
-- 함수로 RLS 를 우회하고, 함수 내부에서 auth.uid() 와 client_id 로 범위를 제한.

create or replace function claim_anon_reports(p_client_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_client_id is null or length(p_client_id) = 0 then
    return 0;
  end if;

  update reports
  set user_id = uid
  where user_id is null
    and client_id = p_client_id;
  get diagnostics claimed_count = row_count;
  return claimed_count;
end;
$$;

grant execute on function claim_anon_reports(text) to authenticated;

-- 이전 마이그레이션(20260409000001)의 auth_claim_anon 정책은 더 이상 사용하지
-- 않지만, 하위 호환을 위해 유지한다. 필요 시 drop policy 로 제거 가능.
