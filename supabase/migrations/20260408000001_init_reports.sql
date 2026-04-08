-- Phase 5a — 리포트 스냅샷 테이블.
-- 입력·결과 전체를 jsonb payload로 저장. RLS는 MVP 단계이므로 anon 전체 허용.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  payload jsonb not null,
  ai_review text,
  created_at timestamptz not null default now()
);

create index if not exists reports_client_created_idx
  on reports (client_id, created_at desc);

alter table reports enable row level security;

create policy anon_all_reports on reports
  for all
  to anon
  using (true)
  with check (true);
