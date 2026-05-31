/**
 * Seed / batch-upsert `vehicle_prices` (Workstream A, step 2).
 *
 * Workflow (crawl phase):
 *   1. Ask Perplexity for the *typical-condition WHOLESALE value* (CAD) of each
 *      common Montréal car — explicitly NOT the asking/listing price, which is
 *      inflated. This is the market number BEFORE your buy margin.
 *   2. Put those numbers in `scripts/vehicle-prices.seed.json`.
 *   3. Run this script. It normalizes make/model (lower + trim, to match
 *      get_vehicle_estimate's lookup) and upserts on (make, model, year),
 *      bumping `priced_at = now()` so the self-aging logic restarts.
 *
 * This DOES write to the database, so it is NOT run automatically. Run it
 * yourself once you've reviewed the data file:
 *
 *   SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  npx tsx scripts/seed-vehicle-prices.ts
 *
 * Use the SERVICE ROLE key — `vehicle_prices` is not writable by anon and is
 * RLS-protected from everyone except staff.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

interface PriceRow {
  make: string;
  model: string;
  year: number;
  market_value: number;
  source?: string; // 'perplexity' | 'cbb' | 'manual'
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  process.exit(1);
}

const norm = (s: string) => s.trim().toLowerCase();

function loadRows(): PriceRow[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(here, "vehicle-prices.seed.json"), "utf8"));
  const rows: PriceRow[] = Array.isArray(raw) ? raw : raw.prices;
  if (!Array.isArray(rows)) {
    throw new Error('Seed file must be an array, or an object with a "prices" array.');
  }
  return rows;
}

function validate(rows: PriceRow[]): PriceRow[] {
  const cleaned: PriceRow[] = [];
  const errors: string[] = [];
  rows.forEach((r, i) => {
    if (!r.make || !r.model) errors.push(`row ${i}: make/model required`);
    if (!Number.isInteger(r.year)) errors.push(`row ${i}: year must be an integer`);
    if (!Number.isFinite(r.market_value) || r.market_value <= 0) {
      errors.push(`row ${i}: market_value must be a positive number (got ${r.market_value})`);
    }
    cleaned.push({
      make: norm(r.make),
      model: norm(r.model),
      year: r.year,
      market_value: Math.round(r.market_value),
      source: r.source || "perplexity",
    });
  });
  if (errors.length) {
    console.error("Validation failed:\n" + errors.join("\n"));
    process.exit(1);
  }
  return cleaned;
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const rows = validate(loadRows());
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ ...r, priced_at: now }));

  console.log(`Upserting ${payload.length} vehicle_prices rows…`);

  // Chunk to keep request sizes sane.
  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("vehicle_prices")
      .upsert(slice, { onConflict: "make,model,year" });
    if (error) {
      console.error("Upsert error:", error);
      process.exit(1);
    }
    upserted += slice.length;
    console.log(`  …${upserted}/${payload.length}`);
  }

  console.log(`Done. ${upserted} rows upserted (priced_at = ${now}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
