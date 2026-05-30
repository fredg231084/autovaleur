# AutoValeur — Build Spec for Claude Code

## Context

AutoValeur buys used cars directly from owners to bypass the *encans* (auctions) and the broker fee. Clients arrive from Google/Facebook ads, go through a React booking widget that estimates the car's value and books an at-home evaluation, where an evaluator confirms the final price and pays on the spot.

- **Market:** Montréal, QC. **Language:** French-first (English/Spanish later).
- **Stack:** React + TypeScript + Vite + Tailwind · Supabase (Postgres + RLS + Edge Functions + Auth) · Vercel · Resend (email via Cloudflare routing) · Twilio (optional, scaffolded).
- **Live today:** public booking widget at `booking.autovaleur.com`. The Supabase schema and the `create-lead` edge function exist. There is **no admin/CRM UI yet** — leads are viewed via the Supabase Table Editor + email alerts.

## Locked decisions

- **Honest pricing** from an internal price table (no live third-party valuation API for now). Seeded via Perplexity, aged automatically by depreciation, refreshed manually from the admin.
- **Gate the estimate:** collect **name + phone before showing the price**. The lead is created at the gate (early capture), *then* the real range is revealed, *then* booking. Operationally, the team calls to pre-qualify before dispatching an evaluator (this protects the cost of each home visit).
- **Standalone CRM**, AutoValeur-only — not a multi-tenant platform. No universal abstraction.
- **Admin lives at `/admin`** inside the same app, **lazy-loaded** (not a separate deployment). Same Supabase project, anon key in the browser, admin role enforced by RLS, single login, `noindex`.

---

## Workstream A — Supabase: backend, pricing engine, security

1. **Apply the pricing migration** (already written: `supabase/migrations/20260530_create_pricing_engine.sql`). It adds `vehicle_prices`, `pricing_config`, and `get_vehicle_estimate()` (SECURITY DEFINER, returns only a display range so the public never sees cost basis or margin).
2. **Seed `vehicle_prices`:** batch the common Montréal cars through Perplexity asking for *typical-condition wholesale value* — explicitly NOT asking-price (listings are inflated). Build a small batch script that upserts rows (`ON CONFLICT (make, model, year) DO UPDATE ... priced_at = now()`), and a `refresh-prices` edge function the admin "refresh stale" button calls.
3. **Security fixes (priority):**
   - **Remove the anon INSERT policy on `leads`** (`"Public can create leads" TO anon WITH CHECK (true)`). All inserts go through `create-lead` (service role), so this policy is unnecessary and is an open spam/abuse hole — anyone with the public anon key can write arbitrary rows directly, bypassing validation, rate limiting, and notifications.
   - **Stop trusting client `up_to`.** Derive/validate the estimate server-side via `get_vehicle_estimate()` at lead creation instead of storing the browser's number verbatim.
   - **Rate limiting** is an in-memory `Map` in the edge function — unreliable (resets on cold start, not shared across instances). Move to a DB-backed check or document the limitation.
   - **Honeypot is dead** — `api.ts` hardcodes `honeypot: ''` and there's no hidden field. Either wire a real hidden field and keep the check, or remove it.
4. **Notification fixes in `create-lead`:**
   - Replace the placeholder phone `514-123-4567` with the real number.
   - Fix the domain inconsistency: the widget uses `info@autovaleur.ca` while the edge function uses `info@autovaleur.com`. Standardize on one.
   - Pull the internal-notification recipient from `app_settings` instead of hardcoding it.
5. **Add a `PARTIAL` value to the `lead_status` enum** to support early capture (Workstream B).
6. **Note:** edge functions and migrations do **not** redeploy from a GitHub push — deploy them via the Supabase CLI.

---

## Workstream B — Booking funnel: honest price + gate

Rework `App.tsx` (currently a 1,930-line monolith — split into `components/` and `lib/` while you're in there; also retire the fake string-length valuation and the postal-hash comparison bars).

New flow:

1. **Car details** — year / make / model / km / drivable. No PII; gets the user invested.
2. **Gate** — name + phone only (email optional, address deferred). Include a clear Loi 25 consent line at this point of collection. On submit, create the lead with status `PARTIAL` via `create-lead` — this is the early capture, so price-step bounces are still contactable leads.
3. **Reveal the estimate** — call `get_vehicle_estimate(make, model, year, km)` and show the real range, framed as "estimation — prix final confirmé à l'inspection." If the car isn't found, fall back to "on confirme par téléphone" and add it to the to-price queue.
4. **Slot selection.**
5. **Finish** — address, optional email, payment preference, final consent. This **enriches the same lead** to status `NEW` (update, not a new row).

Reduce friction throughout: phone is the hero field; collapse the two mandatory checkboxes into one clear consent + a terms link.

---

## Workstream C — Admin dashboard (`/admin`)

Lazy-loaded routes in the same app. Auth guard (redirect to login if not signed in as admin). Keep it out of Google via `robots.txt` disallow on `/admin`. Reference the mockup shown in chat for layout.

- **Login** — Supabase Auth, admin role.
- **Leads** — list with metric cards, source/UTM, and a status flip (Nouveau → Contacté → Acheté / Perdu). **No evaluator assignment.** Click a row → lead detail (vehicle, contact, appointment, full tracking, notes, partial-vs-complete).
- **Prix** — price table with `priced_at` + a stale badge; edit a value by hand; "refresh stale" button (calls `refresh-prices`); add a new car (for the to-price queue); editable config knobs (`buy_factor`, depreciation, etc.).

Make `/admin` a separate code-split chunk so the public funnel bundle never loads dashboard JS.

---

## Code-review cleanup (do alongside)

- `index.html`: `lang="en"` → `"fr"`; replace the internal title; swap the `bolt.new` OG image and `vite.svg` favicon for real branding/meta.
- Remove the orphaned duplicate `packages/shared/src/tracking.ts` (the app uses `src/lib/tracking.ts`). Pick one source of truth; consider `supabase gen types typescript` for shared DB types.
- Add server-side validation: phone/postal format, and `selected_slot_datetime` must be in the future.

---

## Suggested build order

1. **Supabase first** — apply the pricing migration, the security fixes (anon policy, `up_to`), and the notification fixes. Foundation + closes the holes.
2. Seed prices + `refresh-prices` function.
3. Booking funnel rework (gate + real estimate + `PARTIAL` capture).
4. Admin `/admin` dashboard.
5. Cleanup items throughout.

## Out of scope (revisit later)

- Real slot/calendar reservation — slots are currently cosmetic (client-generated, reserve nothing). Acceptable for now because you pre-call to confirm.
- Evaluator assignment, inventory management, advanced analytics.
- Pricing calibration from your own sales data — turn this on once you have transaction history; the schema already captures `final_offer_price` for it.
- Any multi-business / universal CRM work.
