import { supabase } from './supabase';

/**
 * Public-safe estimate, mirrored from get_vehicle_estimate() (SECURITY DEFINER).
 * The RPC returns only a display range — never cost basis or margin — and is
 * granted to anon, so the widget calls it directly to reveal the price after
 * the gate. `found === false` means the car isn't priced yet → the funnel
 * falls back to "on confirme par téléphone".
 */
export interface VehicleEstimate {
  low: number;
  high: number;
  mid: number;
  found: boolean;
  isStale: boolean;
  pricedAt: string | null;
}

export async function getVehicleEstimate(
  make: string,
  model: string,
  year: string | number,
  km: number,
): Promise<VehicleEstimate | null> {
  const p_year = typeof year === 'number' ? year : parseInt(year, 10);
  if (!Number.isFinite(p_year)) return null;

  // The RPC also lower()/trim()s internally; normalize here too so the cache
  // key and the server agree.
  const { data, error } = await supabase.rpc('get_vehicle_estimate', {
    p_make: make.trim().toLowerCase(),
    p_model: model.trim().toLowerCase(),
    p_year,
    p_km: km,
  });

  if (error) {
    console.error('get_vehicle_estimate error:', error);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    low: row.estimate_low ?? 0,
    high: row.estimate_high ?? 0,
    mid: row.estimate_mid ?? 0,
    found: !!row.found,
    isStale: !!row.is_stale,
    pricedAt: row.priced_at ?? null,
  };
}
