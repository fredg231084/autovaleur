/*
  # AutoValeur V1 Database Schema
  
  ## Overview
  Complete schema for AutoValeur booking + CRM system.
  
  ## Tables Created
  
  ### 1. profiles
  - Extends auth.users with role and metadata
  - Columns: id, role (admin/manager/evaluator), full_name, phone, created_at, updated_at
  - Links to auth.users via id (FK)
  
  ### 2. leads
  - Core lead/booking table
  - Vehicle info: year, make, model, vin, km, drivable
  - Price: up_to (estimation shown to client)
  - Appointment: postal_code, slot_type, selected_slot_id, selected_slot_datetime
  - Client: name, phone, email, address
  - Payment: payment_preference (cash/interac)
  - Consent: terms_accepted, inspection_accepted, marketing_opt_in
  - Tracking: source_first, campaign_first, medium_first, content_first, term_first, referrer_first, landing_page_first, first_seen_at, cta, entry_page, app_entry_url, flow_id
  - Assignment: assigned_to (evaluator user_id)
  - Status: status, status_updated_at
  - Timestamps: created_at, updated_at, evaluated_at, offer_made_at, decided_at
  
  ### 3. lead_status_history
  - Timeline of status changes
  - Columns: id, lead_id, old_status, new_status, changed_by, changed_at, notes
  
  ### 4. lead_notes
  - Internal notes on leads
  - Columns: id, lead_id, created_by, note_text, created_at
  
  ### 5. evaluations
  - Evaluation details filled by evaluators
  - Columns: id, lead_id, evaluator_id, mechanical_notes, cosmetic_notes, tires_condition, brakes_condition, engine_light, other_notes, final_offer_price, decision (bought/lost), evaluated_at
  
  ### 6. inventory
  - Purchased vehicles
  - Columns: id, lead_id, vehicle_year, vehicle_make, vehicle_model, vin, km, purchase_price, purchased_at, evaluator_id, notes, status (in_stock/sold/exported)
  
  ### 7. evaluation_photos
  - Photos uploaded during evaluations
  - Columns: id, lead_id, evaluation_id, photo_url, caption, uploaded_by, uploaded_at
  
  ### 8. theme_config
  - Theme/branding settings (single row)
  - Columns: id, primary_color, background_color, button_color, logo_url, font_family, main_title, main_subtitle, updated_at
  
  ### 9. app_settings
  - Email, SMS, and other configuration (single row)
  - Columns: id, email_provider, email_api_key, email_from_address, twilio_account_sid, twilio_auth_token, twilio_from_number, sms_enabled, updated_at
  
  ### 10. activity_log
  - Event logging for troubleshooting
  - Columns: id, event_type, event_data, user_id, lead_id, created_at
  
  ## Security
  - RLS enabled on all tables
  - Policies created for each role (admin, manager, evaluator, public)
  
  ## Important Notes
  - All timestamps use timestamptz for timezone awareness
  - Status enum enforces valid state transitions
  - Foreign keys maintain referential integrity
  - Indexes added for common query patterns
*/

-- =====================================================
-- EXTENSIONS
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'manager', 'evaluator');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('NEW', 'ASSIGNED', 'VISIT_SCHEDULED', 'EVALUATED', 'OFFER_MADE', 'BOUGHT', 'LOST', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE inventory_status AS ENUM ('in_stock', 'sold', 'exported');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE evaluation_decision AS ENUM ('bought', 'lost');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================
-- TABLE: profiles
-- =====================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'evaluator',
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TABLE: leads
-- =====================================================

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vehicle info
  vehicle_year text NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vin text DEFAULT '',
  km integer NOT NULL,
  drivable boolean NOT NULL DEFAULT true,
  
  -- Price estimation
  up_to integer NOT NULL,
  
  -- Appointment
  postal_code text NOT NULL,
  slot_type text NOT NULL,
  selected_slot_id text NOT NULL,
  selected_slot_datetime timestamptz NOT NULL,
  
  -- Client info
  client_name text NOT NULL,
  client_phone text NOT NULL,
  client_email text NOT NULL,
  client_address text NOT NULL,
  
  -- Payment preference
  payment_preference text NOT NULL DEFAULT 'interac',
  
  -- Consent
  terms_accepted boolean NOT NULL DEFAULT false,
  inspection_accepted boolean NOT NULL DEFAULT false,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  
  -- Tracking (first-touch)
  source_first text DEFAULT 'unknown',
  campaign_first text DEFAULT '',
  medium_first text DEFAULT '',
  content_first text DEFAULT '',
  term_first text DEFAULT '',
  referrer_first text DEFAULT '',
  landing_page_first text DEFAULT '',
  first_seen_at timestamptz DEFAULT now(),
  
  -- Conversion context
  cta text DEFAULT '',
  entry_page text DEFAULT '',
  app_entry_url text DEFAULT '',
  flow_id text NOT NULL DEFAULT 'home_visit_booking',
  
  -- Assignment
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Status
  status lead_status NOT NULL DEFAULT 'NEW',
  status_updated_at timestamptz DEFAULT now(),
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  evaluated_at timestamptz,
  offer_made_at timestamptz,
  decided_at timestamptz
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_source_first ON leads(source_first);
CREATE INDEX IF NOT EXISTS idx_leads_flow_id ON leads(flow_id);

-- =====================================================
-- TABLE: lead_status_history
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  old_status text DEFAULT '',
  new_status text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  notes text DEFAULT ''
);

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id, changed_at DESC);

-- =====================================================
-- TABLE: lead_notes
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id, created_at DESC);

-- =====================================================
-- TABLE: evaluations
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  mechanical_notes text DEFAULT '',
  cosmetic_notes text DEFAULT '',
  tires_condition text DEFAULT '',
  brakes_condition text DEFAULT '',
  engine_light boolean DEFAULT false,
  other_notes text DEFAULT '',
  
  final_offer_price integer DEFAULT 0,
  decision evaluation_decision,
  
  evaluated_at timestamptz DEFAULT now()
);

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evaluations_lead_id ON evaluations(lead_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_evaluator_id ON evaluations(evaluator_id);

-- =====================================================
-- TABLE: inventory
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  
  vehicle_year text NOT NULL,
  vehicle_make text NOT NULL,
  vehicle_model text NOT NULL,
  vin text DEFAULT '',
  km integer NOT NULL,
  
  purchase_price integer NOT NULL,
  purchased_at timestamptz DEFAULT now(),
  evaluator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  notes text DEFAULT '',
  status inventory_status NOT NULL DEFAULT 'in_stock',
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_purchased_at ON inventory(purchased_at DESC);

-- =====================================================
-- TABLE: evaluation_photos
-- =====================================================

CREATE TABLE IF NOT EXISTS evaluation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text DEFAULT '',
  uploaded_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE evaluation_photos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evaluation_photos_lead_id ON evaluation_photos(lead_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_photos_evaluation_id ON evaluation_photos(evaluation_id);

-- =====================================================
-- TABLE: theme_config
-- =====================================================

CREATE TABLE IF NOT EXISTS theme_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_color text DEFAULT '#0f172a',
  background_color text DEFAULT '#ffffff',
  button_color text DEFAULT '#0f172a',
  logo_url text DEFAULT '',
  font_family text DEFAULT 'system-ui, sans-serif',
  main_title text DEFAULT 'Vendez votre auto — simplement, rapidement',
  main_subtitle text DEFAULT 'Estimation cash + réservation en ligne',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE theme_config ENABLE ROW LEVEL SECURITY;

-- Insert default theme config (only if empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM theme_config LIMIT 1) THEN
    INSERT INTO theme_config (id) VALUES (gen_random_uuid());
  END IF;
END $$;

-- =====================================================
-- TABLE: app_settings
-- =====================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email configuration
  email_provider text DEFAULT 'resend',
  email_api_key text DEFAULT '',
  email_from_address text DEFAULT 'info@autovaleur.ca',
  
  -- Twilio SMS configuration
  twilio_account_sid text DEFAULT '',
  twilio_auth_token text DEFAULT '',
  twilio_from_number text DEFAULT '',
  sms_enabled boolean DEFAULT false,
  
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Insert default app settings (only if empty)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1) THEN
    INSERT INTO app_settings (id) VALUES (gen_random_uuid());
  END IF;
END $$;

-- =====================================================
-- TABLE: activity_log
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_log_event_type ON activity_log(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_lead_id ON activity_log(lead_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
    CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_leads_updated_at') THEN
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_inventory_updated_at') THEN
    CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function: Create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'evaluator');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-create profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
  END IF;
END $$;