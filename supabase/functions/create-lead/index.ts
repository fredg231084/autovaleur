import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// =====================================================
// Constants
// =====================================================

// Fallback contact phone if app_settings.contact_phone is somehow unset.
// The canonical value lives in app_settings.contact_phone (editable in admin).
const DEFAULT_CONTACT_PHONE = "438-544-3600";

// Rate limit: max submissions per IP per window.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// =====================================================
// Types
// =====================================================

type LeadMode = "partial" | "complete";

interface CreateLeadPayload {
  // 'partial' = early capture at the gate (name + phone + vehicle only).
  // 'complete' = full booking (enriches an existing partial lead if lead_id is
  // provided, otherwise inserts a complete lead directly).
  mode?: LeadMode;
  lead_id?: string; // present on 'complete' to enrich the same row

  // Vehicle
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin?: string;
  km: number;
  drivable: boolean;

  // Appointment (complete only)
  postal_code?: string;
  slot_type?: string;
  selected_slot_id?: string;
  selected_slot_datetime?: string;

  // Client
  client_name: string;
  client_phone: string;
  client_email?: string;
  client_address?: string;

  // Payment
  payment_preference?: string;

  // Consent
  terms_accepted?: boolean;
  inspection_accepted?: boolean;
  marketing_opt_in?: boolean;

  // Tracking
  tracking?: {
    source_first?: string;
    campaign_first?: string;
    medium_first?: string;
    content_first?: string;
    term_first?: string;
    referrer_first?: string;
    landing_page_first?: string;
    first_seen_at?: string;
    cta?: string;
    entry_page?: string;
    app_entry_url?: string;
    flow_id?: string;
  };

  // Anti-spam (honeypot field is wired in Workstream B; the check below is
  // intentionally kept but currently inert).
  honeypot?: string;
}

// =====================================================
// Helpers
// =====================================================

const norm = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// North-American 10-digit (optionally 1-prefixed) phone.
function isValidPhone(phone: string): boolean {
  const d = digitsOnly(phone);
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
}

// Canadian postal code: A1A 1A1 (space optional).
function isValidPostal(postal: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test((postal || "").trim());
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
}

// =====================================================
// Validation (per mode)
// =====================================================

function validatePayload(
  payload: CreateLeadPayload,
  mode: LeadMode,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Always required (available at the gate).
  if (!payload.vehicle_year) errors.push("vehicle_year is required");
  if (!payload.vehicle_make) errors.push("vehicle_make is required");
  if (!payload.vehicle_model) errors.push("vehicle_model is required");
  if (typeof payload.km !== "number") errors.push("km must be a number");
  if (typeof payload.drivable !== "boolean") errors.push("drivable must be a boolean");
  if (!payload.client_name) errors.push("client_name is required");
  if (!payload.client_phone) errors.push("client_phone is required");
  if (payload.client_phone && !isValidPhone(payload.client_phone)) {
    errors.push("Invalid phone format");
  }

  if (mode === "complete") {
    if (!payload.postal_code) errors.push("postal_code is required");
    if (payload.postal_code && !isValidPostal(payload.postal_code)) {
      errors.push("Invalid postal code format");
    }
    if (!payload.selected_slot_datetime) {
      errors.push("selected_slot_datetime is required");
    } else if (new Date(payload.selected_slot_datetime).getTime() <= Date.now()) {
      errors.push("selected_slot_datetime must be in the future");
    }
    // Email stays OPTIONAL even at completion (B funnel is phone-first); the
    // client confirmation email is simply skipped when it's absent. If present,
    // it must be well-formed.
    if (payload.client_email && !isValidEmail(payload.client_email)) {
      errors.push("Invalid email format");
    }
    if (!payload.client_address) errors.push("client_address is required");
    if (!payload.terms_accepted) errors.push("terms_accepted is required");
    if (!payload.inspection_accepted) errors.push("inspection_accepted is required");
  } else {
    // Partial: email is optional but must be well-formed if provided.
    if (payload.client_email && !isValidEmail(payload.client_email)) {
      errors.push("Invalid email format");
    }
  }

  return { valid: errors.length === 0, errors };
}

// =====================================================
// Server-side estimate (never trust the client's up_to)
// =====================================================

async function deriveEstimate(
  supabase: any,
  payload: CreateLeadPayload,
): Promise<{ up_to: number | null; found: boolean }> {
  const year = parseInt(payload.vehicle_year, 10);
  if (!Number.isFinite(year)) return { up_to: null, found: false };

  const { data, error } = await supabase.rpc("get_vehicle_estimate", {
    p_make: norm(payload.vehicle_make),
    p_model: norm(payload.vehicle_model),
    p_year: year,
    p_km: payload.km,
  });

  if (error) {
    console.error("get_vehicle_estimate error:", error);
    return { up_to: null, found: false };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.found) return { up_to: null, found: false };

  // Lead with the high end of the display range ("jusqu'à").
  return { up_to: row.estimate_high ?? null, found: true };
}

// =====================================================
// Email / SMS notifications
// =====================================================

async function sendEmailNotifications(
  supabase: any,
  lead: any,
  mode: LeadMode,
): Promise<void> {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .maybeSingle();

    if (settingsError || !settings || !settings.email_api_key) {
      console.log("Email settings not configured, skipping notifications");
      return;
    }

    const fromAddress = settings.email_from_address || "info@autovaleur.com";
    const notifyEmail = settings.notify_email || "info@autovaleur.com";
    const contactDisplay = settings.contact_phone || DEFAULT_CONTACT_PHONE;
    const contactTel = digitsOnly(contactDisplay);
    const vehicle = `${lead.vehicle_year} ${lead.vehicle_make} ${lead.vehicle_model}`;

    if (settings.email_provider !== "resend") return;
    const resendApiKey = settings.email_api_key;

    // ---- Internal notification (sent for BOTH partial and complete) ----
    const isPartial = mode === "partial";
    const internalHtml = `
      <!DOCTYPE html>
      <html>
      <head><style>
        body { font-family: monospace; font-size: 14px; }
        .header { background: ${isPartial ? "#dbeafe" : "#fef3c7"}; padding: 15px; border-left: 4px solid ${isPartial ? "#3b82f6" : "#f59e0b"}; }
        .section { margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 4px; }
        .label { font-weight: bold; color: #475569; display: inline-block; width: 180px; }
      </style></head>
      <body>
        <div class="header">
          <h2>${isPartial ? "🟦 Capture partielle (gate)" : "🚨 Nouvelle réservation - Action requise"}</h2>
          <p>Lead ID: ${lead.id} — Statut: ${lead.status}</p>
        </div>
        <div class="section">
          <h3>Client</h3>
          <p><span class="label">Nom:</span> ${lead.client_name}</p>
          <p><span class="label">Téléphone:</span> <a href="tel:${lead.client_phone}">${lead.client_phone}</a></p>
          <p><span class="label">Email:</span> ${lead.client_email ? `<a href="mailto:${lead.client_email}">${lead.client_email}</a>` : "—"}</p>
          <p><span class="label">Adresse:</span> ${lead.client_address || "—"}</p>
        </div>
        <div class="section">
          <h3>Véhicule</h3>
          <p><span class="label">Véhicule:</span> ${vehicle}</p>
          <p><span class="label">VIN:</span> ${lead.vin || "Non fourni"}</p>
          <p><span class="label">Kilométrage:</span> ${(lead.km ?? 0).toLocaleString()} km</p>
          <p><span class="label">Condition:</span> ${lead.drivable ? "Roule" : "Ne roule pas"}</p>
        </div>
        <div class="section">
          <h3>Estimation / Rendez-vous</h3>
          <p><span class="label">Estimation (serveur):</span> ${lead.up_to ? `${lead.up_to.toLocaleString()} $` : "À confirmer par téléphone"}</p>
          ${isPartial ? "" : `<p><span class="label">Paiement préféré:</span> ${lead.payment_preference === "cash" ? "Comptant" : "Virement Interac"}</p>`}
        </div>
        <div class="section">
          <h3>Tracking</h3>
          <p><span class="label">Source:</span> ${lead.source_first}</p>
          <p><span class="label">Campaign:</span> ${lead.campaign_first || "N/A"}</p>
          <p><span class="label">CTA:</span> ${lead.cta || "N/A"}</p>
        </div>
        <p style="margin-top: 30px; padding: 15px; background: ${isPartial ? "#eff6ff" : "#dcfce7"}; border-left: 4px solid ${isPartial ? "#3b82f6" : "#16a34a"};">
          <strong>Action:</strong> ${isPartial ? "Lead capturé avant le prix — rappeler pour pré-qualifier." : "Confirmer le rendez-vous dans le CRM."}
        </p>
      </body>
      </html>
    `;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromAddress,
        to: notifyEmail,
        subject: `${isPartial ? "🟦 Lead partiel" : "🚨 Nouveau lead"}: ${vehicle} - ${lead.client_name}`,
        html: internalHtml,
      }),
    });

    // ---- Client confirmation (complete bookings only, requires an email) ----
    if (mode === "complete" && lead.client_email) {
      const slotDate = lead.selected_slot_datetime
        ? new Date(lead.selected_slot_datetime).toLocaleString("fr-CA", {
            weekday: "long", year: "numeric", month: "long",
            day: "numeric", hour: "2-digit", minute: "2-digit",
          })
        : "";
      const estimateLine = lead.up_to
        ? `Jusqu'à ${lead.up_to.toLocaleString()} $`
        : "Confirmée par téléphone";

      const clientHtml = `
        <!DOCTYPE html>
        <html>
        <head><style>
          body { font-family: system-ui, sans-serif; line-height: 1.6; color: #334155; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0f172a; color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; background: #f8fafc; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #64748b; }
          .button { background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #475569; }
        </style></head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Évaluation confirmée</h1>
              <p>Merci ${lead.client_name}, votre rendez-vous est réservé!</p>
            </div>
            <div class="content">
              <h2>Détails de votre réservation</h2>
              <div class="info-row"><span class="label">Véhicule:</span> ${vehicle}</div>
              <div class="info-row"><span class="label">Kilométrage:</span> ${(lead.km ?? 0).toLocaleString()} km</div>
              <div class="info-row"><span class="label">Estimation:</span> ${estimateLine}</div>
              <div class="info-row"><span class="label">Date et heure:</span> ${slotDate}</div>
              <div class="info-row"><span class="label">Adresse:</span> ${lead.client_address}</div>
              <h3>À préparer</h3>
              <ul>
                <li>Clés du véhicule (et 2e clé si disponible)</li>
                <li>Immatriculation et documents du véhicule</li>
                <li>Pièce d'identité</li>
              </ul>
              <p><strong>Note importante:</strong> L'estimation est un montant « jusqu'à ». Le prix final est confirmé après vérification sur place de l'état réel du véhicule.</p>
              <p style="margin-top: 20px;">
                <a href="tel:${contactTel}" class="button">Nous joindre: ${contactDisplay}</a>
              </p>
            </div>
            <div class="footer">
              <p>AutoValeur - Achat de véhicules à domicile</p>
              <p>${fromAddress} | ${contactDisplay}</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: lead.client_email,
          subject: "✅ Votre évaluation AutoValeur est confirmée",
          html: clientHtml,
        }),
      });
    }

    await supabase.from("activity_log").insert({
      event_type: "email_sent",
      event_data: { lead_id: lead.id, mode, notify: notifyEmail },
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("Email error:", error);
    // Never let notification failures block lead creation.
  }
}

async function sendSMSNotification(supabase: any, lead: any): Promise<void> {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .maybeSingle();

    if (settingsError || !settings || !settings.sms_enabled || !settings.twilio_account_sid) {
      return;
    }

    const vehicle = `${lead.vehicle_year} ${lead.vehicle_make} ${lead.vehicle_model}`;
    const slotDate = lead.selected_slot_datetime
      ? new Date(lead.selected_slot_datetime).toLocaleString("fr-CA", {
          weekday: "short", month: "short", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
      : "";

    const contactDisplay = settings.contact_phone || DEFAULT_CONTACT_PHONE;
    const message = `AutoValeur: Votre évaluation pour ${vehicle} est confirmée le ${slotDate}. Nous vous contacterons prochainement. Questions? ${contactDisplay}`;
    const auth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`,
      {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          From: settings.twilio_from_number,
          To: lead.client_phone,
          Body: message,
        }),
      },
    );

    await supabase.from("activity_log").insert({
      event_type: "sms_sent",
      event_data: { lead_id: lead.id, phone: lead.client_phone },
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("SMS error:", error);
  }
}

// =====================================================
// Main Handler
// =====================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, 405);
    }

    const payload: CreateLeadPayload = await req.json();
    const mode: LeadMode = payload.mode === "complete" ? "complete" : "partial";

    // Anti-spam honeypot (kept; wired to a real hidden field in Workstream B).
    if (payload.honeypot) {
      console.log("Honeypot triggered");
      return json({ success: true }, 200); // play dumb for bots
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // DB-backed rate limit (shared across instances, survives cold starts).
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { data: allowed, error: rlError } = await supabase.rpc(
      "check_and_record_rate_limit",
      { p_bucket: `ip:${ip}`, p_max_count: RATE_LIMIT_MAX, p_window_seconds: RATE_LIMIT_WINDOW_SECONDS },
    );
    if (rlError) {
      console.error("rate limit check error:", rlError);
    } else if (allowed === false) {
      return json({ success: false, error: "Too many requests. Please try again later." }, 429);
    }

    // Validate per mode.
    const validation = validatePayload(payload, mode);
    if (!validation.valid) {
      return json({ success: false, error: "Validation failed", details: validation.errors }, 400);
    }

    // Always derive the estimate server-side; client up_to is ignored entirely.
    const { up_to } = await deriveEstimate(supabase, payload);

    const tracking = payload.tracking ?? {};
    const baseVehicle = {
      vehicle_year: payload.vehicle_year,
      vehicle_make: payload.vehicle_make,
      vehicle_model: payload.vehicle_model,
      vin: payload.vin || "",
      km: payload.km,
      drivable: payload.drivable,
      client_name: payload.client_name,
      client_phone: payload.client_phone,
    };

    let lead: any;

    if (mode === "partial") {
      // Early capture: minimal row, status PARTIAL. up_to may be null.
      const { data, error } = await supabase
        .from("leads")
        .insert({
          ...baseVehicle,
          client_email: payload.client_email || null,
          up_to: up_to, // null if the car isn't priced yet
          marketing_opt_in: payload.marketing_opt_in ?? false,
          terms_accepted: payload.terms_accepted ?? false,
          inspection_accepted: payload.inspection_accepted ?? false,
          source_first: tracking.source_first || "unknown",
          campaign_first: tracking.campaign_first || "",
          medium_first: tracking.medium_first || "",
          content_first: tracking.content_first || "",
          term_first: tracking.term_first || "",
          referrer_first: tracking.referrer_first || "",
          landing_page_first: tracking.landing_page_first || "",
          first_seen_at: tracking.first_seen_at || new Date().toISOString(),
          cta: tracking.cta || "",
          entry_page: tracking.entry_page || "",
          app_entry_url: tracking.app_entry_url || "",
          flow_id: tracking.flow_id || "home_visit_booking",
          status: "PARTIAL",
        })
        .select()
        .single();

      if (error) {
        console.error("Partial insert error:", error);
        return json({ success: false, error: "Failed to create lead" }, 500);
      }
      lead = data;
    } else {
      // Complete: NEW lead. A non-null up_to is required by the DB CHECK, so
      // store 0 when the car isn't priced ("to confirm by phone").
      const completeFields = {
        ...baseVehicle,
        up_to: up_to ?? 0,
        postal_code: payload.postal_code,
        slot_type: payload.slot_type || "",
        selected_slot_id: payload.selected_slot_id || "",
        selected_slot_datetime: payload.selected_slot_datetime,
        client_email: payload.client_email || null,
        client_address: payload.client_address,
        payment_preference: payload.payment_preference || "interac",
        terms_accepted: payload.terms_accepted ?? false,
        inspection_accepted: payload.inspection_accepted ?? false,
        marketing_opt_in: payload.marketing_opt_in ?? false,
        status: "NEW",
        status_updated_at: new Date().toISOString(),
      };

      if (payload.lead_id) {
        // Enrich the SAME row created at the gate.
        const { data, error } = await supabase
          .from("leads")
          .update(completeFields)
          .eq("id", payload.lead_id)
          .select()
          .single();
        if (error) {
          console.error("Complete update error:", error);
          return json({ success: false, error: "Failed to update lead" }, 500);
        }
        lead = data;
      } else {
        // No prior partial (e.g. direct submit) — insert a complete lead.
        const { data, error } = await supabase
          .from("leads")
          .insert({
            ...completeFields,
            source_first: tracking.source_first || "unknown",
            campaign_first: tracking.campaign_first || "",
            medium_first: tracking.medium_first || "",
            content_first: tracking.content_first || "",
            term_first: tracking.term_first || "",
            referrer_first: tracking.referrer_first || "",
            landing_page_first: tracking.landing_page_first || "",
            first_seen_at: tracking.first_seen_at || new Date().toISOString(),
            cta: tracking.cta || "",
            entry_page: tracking.entry_page || "",
            app_entry_url: tracking.app_entry_url || "",
            flow_id: tracking.flow_id || "home_visit_booking",
          })
          .select()
          .single();
        if (error) {
          console.error("Complete insert error:", error);
          return json({ success: false, error: "Failed to create lead" }, 500);
        }
        lead = data;
      }
    }

    await supabase.from("activity_log").insert({
      event_type: mode === "partial" ? "lead_partial" : "lead_created",
      event_data: { lead_id: lead.id, source: tracking.source_first || "unknown", mode },
      lead_id: lead.id,
    });

    // Notifications (async; never block the response).
    Promise.all([
      sendEmailNotifications(supabase, lead, mode),
      ...(mode === "complete" ? [sendSMSNotification(supabase, lead)] : []),
    ]).catch(console.error);

    return json({ success: true, data: { lead_id: lead.id, status: lead.status } }, 200);
  } catch (error) {
    console.error("Unexpected error:", error);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
