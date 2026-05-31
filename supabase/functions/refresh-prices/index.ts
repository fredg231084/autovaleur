import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * refresh-prices (Workstream A, step 2)
 *
 * Backs the admin "refresh stale" button. ADMIN-ONLY: the caller's JWT must
 * belong to a profile with role = 'admin'.
 *
 * Three behaviours, picked by request:
 *   - POST { prices: [{make, model, year, market_value, source?}] }
 *       Manual upsert (admin typed/pasted values). Always available.
 *   - POST {} or GET, with PERPLEXITY_API_KEY configured
 *       Auto re-price every stale row via Perplexity, then upsert.
 *   - POST {} or GET, no PERPLEXITY_API_KEY
 *       Return the list of stale rows so the admin can re-price them manually.
 *
 * "Stale" = priced_at older than pricing_config.stale_after_days.
 *
 * NOTE: the Perplexity request shape (endpoint/model/prompt) is a reasonable
 * default — verify it against current Perplexity API docs and tune the parsing
 * before relying on auto-refresh in production.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

interface PriceInput {
  make: string;
  model: string;
  year: number;
  market_value: number;
  source?: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function repriceViaPerplexity(
  apiKey: string,
  car: { make: string; model: string; year: number },
): Promise<number | null> {
  try {
    const prompt =
      `What is the typical-condition WHOLESALE value in Canadian dollars (CAD) of a ` +
      `${car.year} ${car.make} ${car.model} in the Montréal used-car market, at typical ` +
      `mileage for its age? This is the wholesale/trade value, NOT the asking or listing ` +
      `price. Respond with ONLY a single integer number of dollars, no text, no symbols.`;

    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });
    if (!res.ok) {
      console.error("Perplexity error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const digits = text.replace(/[^\d]/g, "");
    const value = parseInt(digits, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch (e) {
    console.error("Perplexity call failed:", e);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // ---- Auth: require an admin caller ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ success: false, error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return json({ success: false, error: "Forbidden: admin only" }, 403);
    }

    // ---- Service-role client for the actual reads/writes ----
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date().toISOString();
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    // ---- Mode 1: manual upsert of provided prices ----
    if (Array.isArray(body?.prices) && body.prices.length > 0) {
      const rows = (body.prices as PriceInput[]).map((p) => ({
        make: norm(p.make),
        model: norm(p.model),
        year: p.year,
        market_value: Math.round(p.market_value),
        source: p.source || "manual",
        priced_at: now,
      }));
      const { error } = await admin
        .from("vehicle_prices")
        .upsert(rows, { onConflict: "make,model,year" });
      if (error) {
        console.error("Manual upsert error:", error);
        return json({ success: false, error: "Upsert failed" }, 500);
      }
      return json({ success: true, mode: "manual", upserted: rows.length }, 200);
    }

    // ---- Determine stale rows ----
    const { data: cfg } = await admin
      .from("pricing_config")
      .select("stale_after_days")
      .eq("id", 1)
      .maybeSingle();
    const staleDays = cfg?.stale_after_days ?? 120;
    const cutoff = new Date(Date.now() - staleDays * 86400 * 1000).toISOString();

    const { data: stale, error: staleErr } = await admin
      .from("vehicle_prices")
      .select("id, make, model, year, market_value, priced_at")
      .lt("priced_at", cutoff)
      .order("priced_at", { ascending: true });

    if (staleErr) {
      console.error("Stale query error:", staleErr);
      return json({ success: false, error: "Failed to read prices" }, 500);
    }

    const staleRows = stale ?? [];
    const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");

    // ---- Mode 3: no auto source — return the list to handle manually ----
    if (!perplexityKey) {
      return json(
        { success: true, mode: "list", stale_count: staleRows.length, stale: staleRows },
        200,
      );
    }

    // ---- Mode 2: auto re-price stale rows via Perplexity ----
    const updates: PriceInput[] = [];
    const failures: any[] = [];
    for (const row of staleRows) {
      const value = await repriceViaPerplexity(perplexityKey, {
        make: row.make, model: row.model, year: row.year,
      });
      if (value) {
        updates.push({ make: row.make, model: row.model, year: row.year, market_value: value, source: "perplexity" });
      } else {
        failures.push({ make: row.make, model: row.model, year: row.year });
      }
    }

    if (updates.length) {
      const rows = updates.map((u) => ({ ...u, priced_at: now }));
      const { error } = await admin
        .from("vehicle_prices")
        .upsert(rows, { onConflict: "make,model,year" });
      if (error) {
        console.error("Auto upsert error:", error);
        return json({ success: false, error: "Upsert failed" }, 500);
      }
    }

    await admin.from("activity_log").insert({
      event_type: "prices_refreshed",
      event_data: { refreshed: updates.length, failed: failures.length, by: userData.user.id },
    });

    return json(
      { success: true, mode: "auto", stale_count: staleRows.length, refreshed: updates.length, failures },
      200,
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
