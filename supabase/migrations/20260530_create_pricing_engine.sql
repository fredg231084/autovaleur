/*
  # AutoValeur Pricing Engine (Crawl Phase)

  A self-aging price table fed by an external source (Perplexity batch / Canadian
  Black Book). No transaction data required.

  Freshness without your own sales data comes from:
    1. Periodic re-batching of `vehicle_prices` (monthly for high-volume cars).
    2. Automatic depreciation aging at READ time, so rows decay correctly
       even between refreshes.
    3. An `is_stale` flag so you know exactly what to re-pull.

  Security model:
    - `vehicle_prices` and `pricing_config` are NEVER readable by the public.
    - The public widget calls get_vehicle_estimate() (SECURITY DEFINER), which
      returns ONLY a display range. Your cost basis, buy_factor, and raw market
      values stay private.
*/

-- =====================================================
-- TABLE: vehicle_prices  (raw market reference)
-- =====================================================

CREATE TABLE IF NOT EXISTS vehicle_prices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make         text    NOT NULL,            -- stored lowercased/trimmed
  model        text    NOT NULL,            -- stored lowercased/trimmed
  year         integer NOT NULL,
  -- Typical-condition market value (CAD) at TYPICAL mileage for the car's age.
  -- This is the market number from your source, BEFORE your buy margin.
  market_value integer NOT NULL,
  source       text    NOT NULL DEFAULT 'perplexity',  -- 'perplexity' | 'cbb' | 'manual'
  priced_at    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make, model, year)               -- one current row per car; refresh = upsert
);

CREATE INDEX IF NOT EXISTS idx_vehicle_prices_lookup
  ON vehicle_prices (make, model, year);

ALTER TABLE vehicle_prices ENABLE ROW LEVEL SECURITY;

-- Admins/managers can manage the table; nobody else sees it.
CREATE POLICY "Staff can manage vehicle_prices"
  ON vehicle_prices FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin','manager'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin','manager'))
  );

-- =====================================================
-- TABLE: pricing_config  (the business knobs, single row)
-- =====================================================

CREATE TABLE IF NOT EXISTS pricing_config (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),

  -- THE main lever: what fraction of market value you're willing to pay.
  -- This is the spread you used to hand the encans. Higher = more competitive
  -- offers, thinner margin. Tune this first.
  buy_factor           numeric NOT NULL DEFAULT 0.80,

  -- Aging: monthly value loss applied between refreshes (~1%/mo ≈ 12%/yr).
  monthly_depreciation numeric NOT NULL DEFAULT 0.010,

  -- Mileage: $ removed per 10,000 km ABOVE the expected mileage for the car's
  -- age (and added back if below). 0 disables mileage adjustment.
  km_adjust_per_10k    integer NOT NULL DEFAULT 400,
  expected_km_per_year integer NOT NULL DEFAULT 18000,

  -- Display range built around the buy estimate. Lead with the high end
  -- ("jusqu'à"), keep the low end honest so the doorstep number lands inside.
  display_low_factor   numeric NOT NULL DEFAULT 0.88,
  display_high_factor  numeric NOT NULL DEFAULT 1.00,

  min_estimate         integer NOT NULL DEFAULT 800,   -- floor
  round_to             integer NOT NULL DEFAULT 250,   -- round display to nearest
  stale_after_days     integer NOT NULL DEFAULT 120,   -- flag rows older than this

  updated_at           timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pricing_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pricing_config"
  ON pricing_config FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- =====================================================
-- FUNCTION: get_vehicle_estimate
-- Returns ONLY a display range. Safe to expose to the public widget.
-- =====================================================

CREATE OR REPLACE FUNCTION get_vehicle_estimate(
  p_make  text,
  p_model text,
  p_year  integer,
  p_km    integer
)
RETURNS TABLE (
  estimate_low  integer,
  estimate_high integer,
  estimate_mid  integer,
  found         boolean,
  is_stale      boolean,
  priced_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v          vehicle_prices%ROWTYPE;
  cfg        pricing_config%ROWTYPE;
  months     numeric;
  aged       numeric;
  exp_km     numeric;
  km_delta   numeric;
  buy_est    numeric;
  lo         numeric;
  hi         numeric;
BEGIN
  SELECT * INTO cfg FROM pricing_config WHERE id = 1;

  SELECT * INTO v
  FROM vehicle_prices
  WHERE make  = lower(trim(p_make))
    AND model = lower(trim(p_model))
    AND year  = p_year
  LIMIT 1;

  -- No row for this car: signal "not found" so the app can fall back to
  -- "on confirme par téléphone" and you can batch-price it later.
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, false, true, NULL::timestamptz;
    RETURN;
  END IF;

  -- 1) Age the market value by months elapsed since it was priced.
  months := GREATEST(0, EXTRACT(EPOCH FROM (now() - v.priced_at)) / (30.44 * 86400));
  aged   := v.market_value * power(1 - cfg.monthly_depreciation, months);

  -- 2) Mileage adjustment vs. expected km for the car's age.
  exp_km   := GREATEST(0, (EXTRACT(YEAR FROM now()) - v.year)) * cfg.expected_km_per_year;
  km_delta := COALESCE(p_km, exp_km) - exp_km;          -- positive = higher mileage
  aged     := aged - (km_delta / 10000.0) * cfg.km_adjust_per_10k;

  -- 3) Apply your buy margin.
  buy_est := GREATEST(aged * cfg.buy_factor, cfg.min_estimate);

  -- 4) Build display range, rounded.
  lo := round((buy_est * cfg.display_low_factor)  / cfg.round_to) * cfg.round_to;
  hi := round((buy_est * cfg.display_high_factor) / cfg.round_to) * cfg.round_to;
  lo := GREATEST(lo, cfg.min_estimate);
  hi := GREATEST(hi, lo);

  RETURN QUERY SELECT
    lo::integer,
    hi::integer,
    round(((lo + hi) / 2.0) / cfg.round_to)::integer * cfg.round_to,
    true,
    (v.priced_at < now() - (cfg.stale_after_days || ' days')::interval),
    v.priced_at;
END;
$$;

-- The widget (anon) and the CRM (authenticated) can call the function,
-- but still cannot read the underlying tables.
GRANT EXECUTE ON FUNCTION get_vehicle_estimate(text, text, integer, integer) TO anon, authenticated;
