-- Phase 6e-1 — 사용자 인증 도입.
-- reports.user_id 추가 (nullable, 기존 anon row와 공존).
-- RLS: 비로그인 시 client_id 기반, 로그인 시 user_id = auth.uid().

alter table reports add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists reports_user_created_idx on reports (user_id, created_at desc);

-- 기존 정책 제거 후 새로 작성
drop policy if exists anon_all_reports on reports;

-- 비로그인(anon) — 본인 client_id의 anon row만 접근
-- 클라이언트가 client_id를 select 시 .eq() 필터로 제한해야 하지만,
-- 보안상 RLS도 걸어둠: user_id가 null일 때만 anon에게 허용.
create policy anon_select_own_clientid on reports
  for select
  to anon
  using (user_id is null);

create policy anon_insert_anon_row on reports
  for insert
  to anon
  with check (user_id is null);

create policy anon_update_own_clientid on reports
  for update
  to anon
  using (user_id is null)
  with check (user_id is null);

create policy anon_delete_own_clientid on reports
  for delete
  to anon
  using (user_id is null);

-- 로그인 사용자 — 본인 user_id row만
create policy auth_select_own on reports
  for select
  to authenticated
  using (user_id = auth.uid());

create policy auth_insert_own on reports
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy auth_update_own on reports
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy auth_delete_own on reports
  for delete
  to authenticated
  using (user_id = auth.uid());
