-- Phase 7-1 — 리포트 공유 URL.
-- is_public 컬럼 추가 + anon/authenticated 에 is_public=true row 의 SELECT 허용.
-- owner update 는 기존 auth_update_own 정책으로 처리 (is_public 컬럼은 일반 컬럼).

alter table reports add column if not exists is_public boolean not null default false;
create index if not exists reports_is_public_idx on reports (is_public) where is_public = true;

-- 공개 리포트는 로그인 여부와 관계없이 누구나 읽을 수 있게 추가 SELECT 정책을 둔다.
-- 기존 정책(anon_select_own_clientid, auth_select_own)과 OR 결합되어,
-- 본인 row + 공개 row 가 모두 보인다.
create policy public_select_shared_anon on reports
  for select
  to anon
  using (is_public = true);

create policy public_select_shared_auth on reports
  for select
  to authenticated
  using (is_public = true);
