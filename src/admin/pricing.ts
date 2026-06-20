import { supabase } from '../lib/supabase';

// =====================================================
// pricing_config — the single-row business knobs (id = 1).
// Mirrors 20260530120000_create_pricing_engine.sql.
// =====================================================

export interface PricingConfig {
  id: number;
  buy_factor: number;
  monthly_depreciation: number;
  km_adjust_per_10k: number;
  expected_km_per_year: number;
  display_low_factor: number;
  display_high_factor: number;
  min_estimate: number;
  round_to: number;
  stale_after_days: number;
  updated_at: string;
}

export type PricingConfigPatch = Partial<Omit<PricingConfig, 'id' | 'updated_at'>>;

export async function fetchPricingConfig(): Promise<PricingConfig> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data as unknown as PricingConfig;
}

export async function updatePricingConfig(patch: PricingConfigPatch): Promise<void> {
  // No updated_at trigger on the table, so stamp it here.
  const { error } = await supabase
    .from('pricing_config')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

// =====================================================
// vehicle_prices — raw market reference, one row per (make, model, year).
// make/model are stored lowercased+trimmed because get_vehicle_estimate()
// looks them up with lower(trim(...)). Any client write MUST match that or
// the public estimate silently misses.
// =====================================================

export interface VehiclePrice {
  id: string;
  make: string;
  model: string;
  year: number;
  market_value: number;
  source: string;
  priced_at: string;
  created_at: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export async function fetchVehiclePrices(): Promise<VehiclePrice[]> {
  const { data, error } = await supabase
    .from('vehicle_prices')
    .select('*')
    .order('make', { ascending: true })
    .order('model', { ascending: true })
    .order('year', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as VehiclePrice[];
}

// Add-a-car and "price this car": insert or refresh a row. A hand-entered
// value is treated as a fresh manual re-price (priced_at = now, source =
// manual), so the stale badge clears. Upsert on the unique key means
// re-pricing an existing car updates it in place.
export async function upsertVehiclePrice(input: {
  make: string;
  model: string;
  year: number;
  market_value: number;
}): Promise<void> {
  const { error } = await supabase.from('vehicle_prices').upsert(
    {
      make: norm(input.make),
      model: norm(input.model),
      year: input.year,
      market_value: Math.round(input.market_value),
      source: 'manual',
      priced_at: new Date().toISOString(),
    },
    { onConflict: 'make,model,year' },
  );
  if (error) throw error;
}

// Inline edit of an existing row's market value — same fresh-re-price
// semantics as upsert (priced_at = now, source = manual).
export async function updateVehiclePrice(id: string, marketValue: number): Promise<void> {
  const { error } = await supabase
    .from('vehicle_prices')
    .update({
      market_value: Math.round(marketValue),
      source: 'manual',
      priced_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export function isPriceStale(pricedAt: string, staleAfterDays: number): boolean {
  const cutoff = Date.now() - staleAfterDays * 86400 * 1000;
  return new Date(pricedAt).getTime() < cutoff;
}

// =====================================================
// refresh-prices edge function — the "refresh stale" button.
// supabase.functions.invoke attaches the caller's session JWT, which the
// function requires to belong to an admin profile. The function answers in
// one of three modes depending on its config (see the function source).
// =====================================================

export interface StaleRow {
  id: string;
  make: string;
  model: string;
  year: number;
  market_value: number;
  priced_at: string;
}

export type RefreshResult =
  // Perplexity configured: stale rows were auto re-priced.
  | { success: true; mode: 'auto'; stale_count: number; refreshed: number; failures: unknown[] }
  // No auto source: the function hands back the stale list to price manually.
  | { success: true; mode: 'list'; stale_count: number; stale: StaleRow[] }
  // Reached only when we post explicit prices (not used by the button).
  | { success: true; mode: 'manual'; upserted: number };

export async function refreshStalePrices(): Promise<RefreshResult> {
  const { data, error } = await supabase.functions.invoke('refresh-prices', { body: {} });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Échec du rafraîchissement.');
  return data as RefreshResult;
}
