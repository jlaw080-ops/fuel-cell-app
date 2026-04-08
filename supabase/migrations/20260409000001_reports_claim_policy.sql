-- Phase 6e-2 — anon → user 리포트 흡수 정책.
-- 로그인 사용자가 user_id 가 null 인 기존 anon row 를 본인 것으로 claim 할 수 있게 허용.
-- 필터는 애플리케이션(claimAnonReports) 에서 client_id 로 제한한다.

create policy auth_claim_anon on reports
  for update
  to authenticated
  using (user_id is null)
  with check (user_id = auth.uid());
