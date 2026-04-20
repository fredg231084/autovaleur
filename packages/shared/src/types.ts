/**
 * Shared TypeScript types for AutoValeur
 * Used across public app, CRM, and Edge Functions
 */

// =====================================================
// Database Types
// =====================================================

export type UserRole = 'admin' | 'manager' | 'evaluator';

export type LeadStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'VISIT_SCHEDULED'
  | 'EVALUATED'
  | 'OFFER_MADE'
  | 'BOUGHT'
  | 'LOST'
  | 'CANCELLED';

export type InventoryStatus = 'in_stock' | 'sold' | 'exported';

export type EvaluationDecision = 'bought' | 'lost';

export type PaymentPreference = 'cash' | 'interac';

export type SlotType = 'today' | 'tomorrow' | 'week';

// =====================================================
// Table Types
// =====================================================

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;

  // Vehicle info
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
  payment_preference: PaymentPreference;

  // Consent
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;

  // Tracking
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

  // Assignment
  assigned_to: string | null;

  // Status
  status: LeadStatus;
  status_updated_at: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  evaluated_at: string | null;
  offer_made_at: string | null;
  decided_at: string | null;
}

export interface LeadStatusHistory {
  id: string;
  lead_id: string;
  old_status: string;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  created_by: string;
  note_text: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  lead_id: string;
  evaluator_id: string;

  mechanical_notes: string;
  cosmetic_notes: string;
  tires_condition: string;
  brakes_condition: string;
  engine_light: boolean;
  other_notes: string;

  final_offer_price: number;
  decision: EvaluationDecision | null;

  evaluated_at: string;
}

export interface Inventory {
  id: string;
  lead_id: string;

  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin: string;
  km: number;

  purchase_price: number;
  purchased_at: string;
  evaluator_id: string;

  notes: string;
  status: InventoryStatus;

  created_at: string;
  updated_at: string;
}

export interface EvaluationPhoto {
  id: string;
  lead_id: string;
  evaluation_id: string | null;
  photo_url: string;
  caption: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ThemeConfig {
  id: string;
  primary_color: string;
  background_color: string;
  button_color: string;
  logo_url: string;
  font_family: string;
  main_title: string;
  main_subtitle: string;
  updated_at: string;
}

export interface AppSettings {
  id: string;

  // Email
  email_provider: string;
  email_api_key: string;
  email_from_address: string;

  // SMS
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_from_number: string;
  sms_enabled: boolean;

  updated_at: string;
}

export interface ActivityLog {
  id: string;
  event_type: string;
  event_data: Record<string, any>;
  user_id: string | null;
  lead_id: string | null;
  created_at: string;
}

// =====================================================
// API Types
// =====================================================

export interface CreateLeadPayload {
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
  slot_type: SlotType;
  selected_slot_id: string;
  selected_slot_datetime: string;

  // Client
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;

  // Payment
  payment_preference: PaymentPreference;

  // Consent
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;

  // Tracking
  tracking: TrackingData;

  // Anti-spam
  honeypot?: string;
}

export interface TrackingData {
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
}

export interface TimeSlot {
  id: string;
  start: Date;
  label: string;
}

// =====================================================
// Email Types
// =====================================================

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface ClientConfirmationEmailData {
  client_name: string;
  vehicle: string;
  slot_datetime: string;
  address: string;
  up_to: number;
}

export interface InternalNotificationEmailData {
  lead_id: string;
  client_name: string;
  vehicle: string;
  km: number;
  up_to: number;
  slot_datetime: string;
  address: string;
  phone: string;
  email: string;
}

// =====================================================
// SMS Types
// =====================================================

export interface SendSMSPayload {
  to: string;
  message: string;
}

// =====================================================
// Dashboard/Analytics Types
// =====================================================

export interface DashboardMetrics {
  // Totals
  total_leads: number;
  leads_today: number;
  leads_this_week: number;
  leads_this_month: number;

  // Conversion rates
  booking_rate: number; // leads -> visit_scheduled
  evaluation_rate: number; // visit_scheduled -> evaluated
  purchase_rate: number; // evaluated -> bought

  // Average times (in hours)
  avg_time_to_evaluation: number;
  avg_time_to_decision: number;

  // Financial
  avg_estimation: number;
  avg_final_price: number;
  total_purchases_value: number;

  // By source
  by_source: Array<{
    source: string;
    count: number;
    conversion_rate: number;
  }>;

  // By evaluator
  by_evaluator: Array<{
    evaluator_id: string;
    evaluator_name: string;
    leads_assigned: number;
    leads_evaluated: number;
    leads_purchased: number;
    avg_final_price: number;
  }>;

  // By status
  by_status: Array<{
    status: LeadStatus;
    count: number;
  }>;
}

// =====================================================
// Filter Types
// =====================================================

export interface LeadFilters {
  status?: LeadStatus[];
  assigned_to?: string[];
  source_first?: string[];
  flow_id?: string[];
  date_from?: string;
  date_to?: string;
  search?: string;
}

// =====================================================
// Helper Types
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
