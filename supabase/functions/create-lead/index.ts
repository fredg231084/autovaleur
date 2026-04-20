import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// =====================================================
// Types
// =====================================================

interface CreateLeadPayload {
  // Vehicle
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin: string;
  km: number;
  drivable: boolean;

  // Price
  up_to: number;

  // Appointment
  postal_code: string;
  slot_type: string;
  selected_slot_id: string;
  selected_slot_datetime: string;

  // Client
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;

  // Payment
  payment_preference: string;

  // Consent
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;

  // Tracking
  tracking: {
    source_first: string;
    campaign_first: string;
    medium_first: string;
    content_first: string;
    term_first: string;
    referrer_first: string;
    landing_page_first: string;
    first_seen_at: string;
    cta: string;
    entry_page: string;
    app_entry_url: string;
    flow_id: string;
  };

  // Anti-spam
  honeypot?: string;
}

// =====================================================
// Rate Limiting (Simple)
// =====================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(ip);

  if (!limit || now > limit.resetAt) {
    // Reset or first request
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 }); // 1 minute window
    return false;
  }

  if (limit.count >= 3) {
    // Max 3 submissions per minute
    return true;
  }

  limit.count++;
  return false;
}

// =====================================================
// Validation
// =====================================================

function validatePayload(payload: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!payload.vehicle_year) errors.push("vehicle_year is required");
  if (!payload.vehicle_make) errors.push("vehicle_make is required");
  if (!payload.vehicle_model) errors.push("vehicle_model is required");
  if (typeof payload.km !== "number") errors.push("km must be a number");
  if (typeof payload.up_to !== "number") errors.push("up_to must be a number");
  if (!payload.postal_code) errors.push("postal_code is required");
  if (!payload.selected_slot_datetime) errors.push("selected_slot_datetime is required");
  if (!payload.client_name) errors.push("client_name is required");
  if (!payload.client_phone) errors.push("client_phone is required");
  if (!payload.client_email) errors.push("client_email is required");
  if (!payload.client_address) errors.push("client_address is required");

  // Consent
  if (!payload.terms_accepted) errors.push("terms_accepted is required");
  if (!payload.inspection_accepted) errors.push("inspection_accepted is required");

  // Email validation
  if (payload.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.client_email)) {
    errors.push("Invalid email format");
  }

  return { valid: errors.length === 0, errors };
}

// =====================================================
// Email/SMS Helpers
// =====================================================

async function sendEmailNotifications(supabase: any, lead: any): Promise<void> {
  try {
    // Get app settings
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .maybeSingle();

    if (settingsError || !settings || !settings.email_api_key) {
      console.log("Email settings not configured, skipping notifications");
      return;
    }

    const vehicle = `${lead.vehicle_year} ${lead.vehicle_make} ${lead.vehicle_model}`;
    const slotDate = new Date(lead.selected_slot_datetime).toLocaleString("fr-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Client confirmation email
    const clientHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: system-ui, sans-serif; line-height: 1.6; color: #334155; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #0f172a; color: white; padding: 20px; border-radius: 8px; }
          .content { padding: 20px; background: #f8fafc; border-radius: 8px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; font-size: 14px; color: #64748b; }
          .button { background: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
          .info-row { margin: 10px 0; }
          .label { font-weight: bold; color: #475569; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Évaluation confirmée</h1>
            <p>Merci ${lead.client_name}, votre rendez-vous est réservé!</p>
          </div>

          <div class="content">
            <h2>Détails de votre réservation</h2>

            <div class="info-row">
              <span class="label">Véhicule:</span> ${vehicle}
            </div>
            <div class="info-row">
              <span class="label">Kilométrage:</span> ${lead.km.toLocaleString()} km
            </div>
            <div class="info-row">
              <span class="label">Estimation:</span> Jusqu'à ${lead.up_to.toLocaleString()} $
            </div>
            <div class="info-row">
              <span class="label">Date et heure:</span> ${slotDate}
            </div>
            <div class="info-row">
              <span class="label">Adresse:</span> ${lead.client_address}
            </div>

            <h3>À préparer</h3>
            <ul>
              <li>Clés du véhicule (et 2e clé si disponible)</li>
              <li>Immatriculation et documents du véhicule</li>
              <li>Pièce d'identité</li>
            </ul>

            <p><strong>Note importante:</strong> L'estimation de ${lead.up_to.toLocaleString()} $ est un montant "jusqu'à". Le prix final sera confirmé après vérification sur place de l'état réel du véhicule.</p>

            <p style="margin-top: 20px;">
              <a href="tel:5141234567" class="button">Nous joindre: 514-123-4567</a>
            </p>
          </div>

          <div class="footer">
            <p>AutoValeur - Achat de véhicules à domicile</p>
            <p>info@autovaleur.com | 514-123-4567</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Internal notification email
    const internalHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: monospace; font-size: 14px; }
          .header { background: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; }
          .section { margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 4px; }
          .label { font-weight: bold; color: #475569; display: inline-block; width: 180px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>🚨 Nouvelle réservation - Action requise</h2>
          <p>Lead ID: ${lead.id}</p>
        </div>

        <div class="section">
          <h3>Client</h3>
          <p><span class="label">Nom:</span> ${lead.client_name}</p>
          <p><span class="label">Téléphone:</span> <a href="tel:${lead.client_phone}">${lead.client_phone}</a></p>
          <p><span class="label">Email:</span> <a href="mailto:${lead.client_email}">${lead.client_email}</a></p>
          <p><span class="label">Adresse:</span> ${lead.client_address}</p>
        </div>

        <div class="section">
          <h3>Véhicule</h3>
          <p><span class="label">Véhicule:</span> ${vehicle}</p>
          <p><span class="label">VIN:</span> ${lead.vin || "Non fourni"}</p>
          <p><span class="label">Kilométrage:</span> ${lead.km.toLocaleString()} km</p>
          <p><span class="label">Condition:</span> ${lead.drivable ? "Roule" : "Ne roule pas"}</p>
        </div>

        <div class="section">
          <h3>Rendez-vous</h3>
          <p><span class="label">Date/Heure:</span> ${slotDate}</p>
          <p><span class="label">Estimation affichée:</span> ${lead.up_to.toLocaleString()} $</p>
          <p><span class="label">Paiement préféré:</span> ${lead.payment_preference === "cash" ? "Comptant" : "Virement Interac"}</p>
        </div>

        <div class="section">
          <h3>Tracking</h3>
          <p><span class="label">Source:</span> ${lead.source_first}</p>
          <p><span class="label">Campaign:</span> ${lead.campaign_first || "N/A"}</p>
          <p><span class="label">Medium:</span> ${lead.medium_first || "N/A"}</p>
          <p><span class="label">CTA:</span> ${lead.cta || "N/A"}</p>
        </div>

        <p style="margin-top: 30px; padding: 15px; background: #dcfce7; border-left: 4px solid #16a34a;">
          <strong>Action:</strong> Assigner un évaluateur dans le CRM
        </p>
      </body>
      </html>
    `;

    // Send emails based on provider
    if (settings.email_provider === "resend") {
      // Send via Resend
      const resendApiKey = settings.email_api_key;

      // Client email
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: settings.email_from_address,
          to: lead.client_email,
          subject: "✅ Votre évaluation AutoValeur est confirmée",
          html: clientHtml,
        }),
      });

      // Internal email
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: settings.email_from_address,
          to: "info@autovaleur.com",
          subject: `🚨 Nouveau lead: ${vehicle} - ${lead.client_name}`,
          html: internalHtml,
        }),
      });
    }

    // Log success
    await supabase.from("activity_log").insert({
      event_type: "email_sent",
      event_data: { lead_id: lead.id, recipient: lead.client_email },
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("Email error:", error);
    // Don't throw - we don't want email failures to block lead creation
  }
}

async function sendSMSNotification(supabase: any, lead: any): Promise<void> {
  try {
    // Get app settings
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("*")
      .maybeSingle();

    if (settingsError || !settings || !settings.sms_enabled || !settings.twilio_account_sid) {
      console.log("SMS not configured or disabled, skipping");
      return;
    }

    const vehicle = `${lead.vehicle_year} ${lead.vehicle_make} ${lead.vehicle_model}`;
    const slotDate = new Date(lead.selected_slot_datetime).toLocaleString("fr-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const message = `AutoValeur: Votre évaluation pour ${vehicle} est confirmée le ${slotDate}. Nous vous contacterons prochainement. Questions? 514-123-4567`;

    // Send via Twilio
    const auth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);

    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          From: settings.twilio_from_number,
          To: lead.client_phone,
          Body: message,
        }),
      }
    );

    // Log success
    await supabase.from("activity_log").insert({
      event_type: "sms_sent",
      event_data: { lead_id: lead.id, phone: lead.client_phone },
      lead_id: lead.id,
    });
  } catch (error) {
    console.error("SMS error:", error);
    // Don't throw - we don't want SMS failures to block lead creation
  }
}

// =====================================================
// Main Handler
// =====================================================

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse payload
    const payload: CreateLeadPayload = await req.json();

    // Anti-spam: Honeypot check
    if (payload.honeypot) {
      console.log("Honeypot triggered");
      return new Response(
        JSON.stringify({ success: true }), // Return success to confuse bots
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate payload
    const validation = validatePayload(payload);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "Validation failed", details: validation.errors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client (service role for insert)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Create lead
    const { data: lead, error: insertError } = await supabase
      .from("leads")
      .insert({
        vehicle_year: payload.vehicle_year,
        vehicle_make: payload.vehicle_make,
        vehicle_model: payload.vehicle_model,
        vin: payload.vin || "",
        km: payload.km,
        drivable: payload.drivable,
        up_to: payload.up_to,
        postal_code: payload.postal_code,
        slot_type: payload.slot_type,
        selected_slot_id: payload.selected_slot_id,
        selected_slot_datetime: payload.selected_slot_datetime,
        client_name: payload.client_name,
        client_phone: payload.client_phone,
        client_email: payload.client_email,
        client_address: payload.client_address,
        payment_preference: payload.payment_preference,
        terms_accepted: payload.terms_accepted,
        inspection_accepted: payload.inspection_accepted,
        marketing_opt_in: payload.marketing_opt_in,
        source_first: payload.tracking.source_first,
        campaign_first: payload.tracking.campaign_first,
        medium_first: payload.tracking.medium_first,
        content_first: payload.tracking.content_first,
        term_first: payload.tracking.term_first,
        referrer_first: payload.tracking.referrer_first,
        landing_page_first: payload.tracking.landing_page_first,
        first_seen_at: payload.tracking.first_seen_at,
        cta: payload.tracking.cta,
        entry_page: payload.tracking.entry_page,
        app_entry_url: payload.tracking.app_entry_url,
        flow_id: payload.tracking.flow_id,
        status: "NEW",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create lead" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Log lead creation
    await supabase.from("activity_log").insert({
      event_type: "lead_created",
      event_data: { lead_id: lead.id, source: payload.tracking.source_first },
      lead_id: lead.id,
    });

    // Send notifications (async, don't block response)
    Promise.all([
      sendEmailNotifications(supabase, lead),
      sendSMSNotification(supabase, lead),
    ]).catch(console.error);

    // Return success
    return new Response(
      JSON.stringify({ success: true, data: { lead_id: lead.id } }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
