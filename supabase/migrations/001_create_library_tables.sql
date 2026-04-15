-- ============================================================
-- 001_create_library_tables.sql
-- 연료전지 라이브러리 데이터를 Supabase 테이블로 마이그레이션
-- Supabase Studio > SQL Editor 에서 실행
-- ============================================================

-- 1. 연료전지 제품 라이브러리
CREATE TABLE IF NOT EXISTS fuel_cell_products (
  id                    SERIAL PRIMARY KEY,
  type                  TEXT NOT NULL CHECK (type IN ('PEMFC', 'SOFC', 'PAFC')),
  manufacturer          TEXT NOT NULL,
  model_name            TEXT,
  rated_power_kw        NUMERIC NOT NULL,
  heat_output_kw        NUMERIC,
  gas_input_kw          NUMERIC,
  electric_efficiency   NUMERIC NOT NULL,
  heat_recovery_efficiency NUMERIC,
  install_cost_per_kw   NUMERIC,
  om_cost_per_kw_year   NUMERIC,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 월별 가동일 프로파일
CREATE TABLE IF NOT EXISTS operation_profiles (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  annual_days  INTEGER NOT NULL,
  monthly_days INTEGER[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 전기요금 플랜 (헤더)
CREATE TABLE IF NOT EXISTS electricity_tariff_plans (
  id                 SERIAL PRIMARY KEY,
  plan_name          TEXT NOT NULL UNIQUE,
  base_charge_per_kw NUMERIC NOT NULL,
  unit               TEXT NOT NULL DEFAULT '원/kWh',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 전기요금 월별 단가 (상세)
CREATE TABLE IF NOT EXISTS electricity_tariff_monthly (
  id        SERIAL PRIMARY KEY,
  plan_id   INTEGER NOT NULL REFERENCES electricity_tariff_plans(id) ON DELETE CASCADE,
  month     INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  off_peak  NUMERIC NOT NULL,
  mid_peak  NUMERIC NOT NULL,
  on_peak   NUMERIC NOT NULL,
  UNIQUE (plan_id, month)
);

-- 5. 가스요금 라이브러리
CREATE TABLE IF NOT EXISTS gas_tariffs (
  id                 SERIAL PRIMARY KEY,
  name               TEXT NOT NULL UNIQUE,
  unit_price_per_kwh NUMERIC NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 설정
-- 라이브러리 데이터는 로그인 없이도 읽기 가능
-- ============================================================
ALTER TABLE fuel_cell_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_tariff_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE electricity_tariff_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_tariffs             ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read fuel_cell_products"
  ON fuel_cell_products FOR SELECT USING (true);

CREATE POLICY "Public read operation_profiles"
  ON operation_profiles FOR SELECT USING (true);

CREATE POLICY "Public read electricity_tariff_plans"
  ON electricity_tariff_plans FOR SELECT USING (true);

CREATE POLICY "Public read electricity_tariff_monthly"
  ON electricity_tariff_monthly FOR SELECT USING (true);

CREATE POLICY "Public read gas_tariffs"
  ON gas_tariffs FOR SELECT USING (true);
