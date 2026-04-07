-- ============================================================
-- Phase 2: 입력 데이터 테이블 (Tab1)
-- ============================================================
-- 목적: 사용자가 탭1에서 입력한 연료전지 정보(Input1)와
--       운전시간 정보(Input2)를 저장한다.
--
-- 인증 전략 (Phase 2 결정):
--   - 익명 사용자(anon role) + RLS 전체 허용
--   - 사용자 식별: 클라이언트 localStorage UUID (client_id)
--   - Phase 5/6에서 Supabase Auth 도입 시 user_id로 마이그레이션 예정
--
-- 주의: client_id는 신뢰할 수 없음. 민감 데이터 저장 금지.
-- ============================================================

-- ------------------------------------------------------------
-- 1. fuel_cell_inputs : 연료전지 입력 (Input1)
-- ------------------------------------------------------------
create table if not exists public.fuel_cell_inputs (
  id          uuid        primary key default gen_random_uuid(),
  client_id   text        not null,
  payload     jsonb       not null,
  created_at  timestamptz not null default now()
);

comment on table public.fuel_cell_inputs is
  'Tab1 Input1: 연료전지 제품 세트 입력. payload는 FuelCellInput 타입(JSON).';
comment on column public.fuel_cell_inputs.client_id is
  '클라이언트 localStorage UUID. 사용자 구분용. Auth 도입 전 임시 식별자.';
comment on column public.fuel_cell_inputs.payload is
  'src/types/inputs.ts FuelCellInput 형식. { sets: [...], 총설치용량_kW: number }';

create index if not exists fuel_cell_inputs_client_created_idx
  on public.fuel_cell_inputs (client_id, created_at desc);

-- ------------------------------------------------------------
-- 2. operation_inputs : 운전시간 입력 (Input2)
-- ------------------------------------------------------------
create table if not exists public.operation_inputs (
  id          uuid        primary key default gen_random_uuid(),
  client_id   text        not null,
  payload     jsonb       not null,
  created_at  timestamptz not null default now()
);

comment on table public.operation_inputs is
  'Tab1 Input2: 운전시간 입력. payload는 OperationInput 타입(JSON).';
comment on column public.operation_inputs.client_id is
  '클라이언트 localStorage UUID. fuel_cell_inputs.client_id와 동일 값.';
comment on column public.operation_inputs.payload is
  'src/types/inputs.ts OperationInput 형식. { 연간운전유형, 연간운전일수, 일일_중간부하_운전시간, 일일_최대부하_운전시간 }';

create index if not exists operation_inputs_client_created_idx
  on public.operation_inputs (client_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS 활성화 + 정책 (anon 전체 허용)
-- ------------------------------------------------------------
alter table public.fuel_cell_inputs enable row level security;
alter table public.operation_inputs enable row level security;

-- fuel_cell_inputs
drop policy if exists "anon_all_fuel_cell_inputs" on public.fuel_cell_inputs;
create policy "anon_all_fuel_cell_inputs"
  on public.fuel_cell_inputs
  for all
  to anon
  using (true)
  with check (true);

-- operation_inputs
drop policy if exists "anon_all_operation_inputs" on public.operation_inputs;
create policy "anon_all_operation_inputs"
  on public.operation_inputs
  for all
  to anon
  using (true)
  with check (true);
