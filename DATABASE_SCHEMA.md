# Database Schema Reference

## Schema Visualization

```
┌──────────────┐
│ auth.users   │ (Supabase managed)
└──────┬───────┘
       │
       │ 1:1
       ↓
┌──────────────┐
│  profiles    │
│──────────────│
│ id (PK)      │──┐
│ role         │  │
│ full_name    │  │
│ phone        │  │
└──────────────┘  │
                   │
                   │ 1:N (assigned_to)
                   │
┌──────────────┐  │
│    leads     │←─┘
│──────────────│
│ id (PK)      │──┐
│ vehicle_*    │  │
│ client_*     │  │
│ tracking_*   │  │
│ status       │  │
│ assigned_to  │  │
└──────────────┘  │
       │          │
       │ 1:N      │ 1:N
       ↓          ↓
┌──────────────┐ ┌──────────────┐
│ evaluations  │ │ lead_notes   │
│──────────────│ │──────────────│
│ id (PK)      │ │ id (PK)      │
│ lead_id (FK) │ │ lead_id (FK) │
│ evaluator_id │ │ created_by   │
│ *_notes      │ │ note_text    │
│ decision     │ └──────────────┘
└──────┬───────┘
       │          ┌──────────────┐
       │ 1:N      │ lead_status_ │
       ↓          │   history    │
┌──────────────┐ │──────────────│
│ evaluation_  │ │ id (PK)      │
│   photos     │ │ lead_id (FK) │
│──────────────│ │ old_status   │
│ id (PK)      │ │ new_status   │
│ lead_id (FK) │ │ changed_by   │
│ photo_url    │ └──────────────┘
└──────────────┘
       │
       │ 1:1 (on BOUGHT)
       ↓
┌──────────────┐
│  inventory   │
│──────────────│
│ id (PK)      │
│ lead_id (FK) │
│ vehicle_*    │
│ purchase_*   │
│ status       │
└──────────────┘

┌──────────────┐ ┌──────────────┐
│ theme_config │ │ app_settings │
│──────────────│ │──────────────│
│ id (PK)      │ │ id (PK)      │
│ colors       │ │ email_*      │
│ logo_url     │ │ twilio_*     │
│ text         │ │ sms_enabled  │
└──────────────┘ └──────────────┘

┌──────────────┐
│ activity_log │
│──────────────│
│ id (PK)      │
│ event_type   │
│ event_data   │
│ user_id (FK) │
│ lead_id (FK) │
└──────────────┘
```

## Tables Overview

### Core Tables

#### profiles
Extends Supabase auth.users with role and metadata.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | - | FK to auth.users |
| role | enum | evaluator | admin, manager, evaluator |
| full_name | text | '' | Display name |
| phone | text | '' | Contact number |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | Auto-updated |

**Indexes:** Primary key on id

**RLS:**
- Authenticated users can read all profiles
- Users can update their own profile

---

#### leads
Core table storing all lead/booking information.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| **Identity** |
| id | uuid | gen_random_uuid() | Primary key |
| **Vehicle** |
| vehicle_year | text | - | Required |
| vehicle_make | text | - | Required |
| vehicle_model | text | - | Required |
| vin | text | '' | Optional |
| km | integer | - | Required |
| drivable | boolean | true | Can vehicle drive? |
| **Price** |
| up_to | integer | - | Estimation shown to client |
| **Appointment** |
| postal_code | text | - | Required |
| slot_type | text | - | today, tomorrow, week |
| selected_slot_id | text | - | Unique slot identifier |
| selected_slot_datetime | timestamptz | - | Actual datetime |
| **Client** |
| client_name | text | - | Required |
| client_phone | text | - | Required |
| client_email | text | - | Required |
| client_address | text | - | Required |
| **Payment** |
| payment_preference | text | interac | cash or interac |
| **Consent** |
| terms_accepted | boolean | false | Required |
| inspection_accepted | boolean | false | Required |
| marketing_opt_in | boolean | false | Optional |
| **Tracking (First-Touch)** |
| source_first | text | unknown | Classified source |
| campaign_first | text | '' | utm_campaign |
| medium_first | text | '' | utm_medium |
| content_first | text | '' | utm_content |
| term_first | text | '' | utm_term |
| referrer_first | text | '' | document.referrer |
| landing_page_first | text | '' | First page visited |
| first_seen_at | timestamptz | now() | First visit timestamp |
| **Conversion Context** |
| cta | text | '' | Which CTA clicked |
| entry_page | text | '' | Page entered from |
| app_entry_url | text | '' | Full URL at submission |
| flow_id | text | home_visit_booking | For multi-app reuse |
| **Assignment** |
| assigned_to | uuid | null | FK to profiles |
| **Status** |
| status | enum | NEW | See status enum |
| status_updated_at | timestamptz | now() | Last status change |
| **Timestamps** |
| created_at | timestamptz | now() | Lead created |
| updated_at | timestamptz | now() | Auto-updated |
| evaluated_at | timestamptz | null | Set when evaluated |
| offer_made_at | timestamptz | null | Set when offer made |
| decided_at | timestamptz | null | Set when bought/lost |

**Indexes:**
- `idx_leads_status` - Filter by status
- `idx_leads_assigned_to` - Evaluator queries
- `idx_leads_created_at` - Date sorting
- `idx_leads_source_first` - Analytics
- `idx_leads_flow_id` - Multi-app filtering

**RLS:**
- Public can INSERT only
- Admins/managers can SELECT/UPDATE all
- Evaluators can SELECT/UPDATE only assigned leads

---

#### lead_status_history
Audit trail of status changes.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| lead_id | uuid | - | FK to leads |
| old_status | text | '' | Previous status |
| new_status | text | - | New status |
| changed_by | uuid | null | FK to profiles |
| changed_at | timestamptz | now() | When changed |
| notes | text | '' | Optional note |

**Indexes:**
- `idx_lead_status_history_lead_id` - Query by lead

**RLS:**
- Admins/managers can SELECT all
- Evaluators can SELECT for assigned leads
- Authenticated can INSERT (logged automatically)

---

#### lead_notes
Internal notes on leads.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| lead_id | uuid | - | FK to leads |
| created_by | uuid | - | FK to profiles |
| note_text | text | - | Required |
| created_at | timestamptz | now() | |

**Indexes:**
- `idx_lead_notes_lead_id` - Query by lead

**RLS:**
- Admins/managers can SELECT all
- Evaluators can SELECT for assigned leads
- Authenticated can INSERT

---

#### evaluations
Evaluation details filled by evaluators.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| lead_id | uuid | - | FK to leads |
| evaluator_id | uuid | - | FK to profiles |
| mechanical_notes | text | '' | Mechanical condition |
| cosmetic_notes | text | '' | Body/paint condition |
| tires_condition | text | '' | Tire assessment |
| brakes_condition | text | '' | Brake assessment |
| engine_light | boolean | false | Check engine light on? |
| other_notes | text | '' | Additional notes |
| final_offer_price | integer | 0 | Actual offer amount |
| decision | enum | null | bought or lost |
| evaluated_at | timestamptz | now() | |

**Indexes:**
- `idx_evaluations_lead_id` - Query by lead
- `idx_evaluations_evaluator_id` - Query by evaluator

**RLS:**
- Admins/managers can SELECT all
- Evaluators can SELECT/INSERT/UPDATE own evaluations

---

#### inventory
Purchased vehicles.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| lead_id | uuid | - | FK to leads |
| vehicle_year | text | - | |
| vehicle_make | text | - | |
| vehicle_model | text | - | |
| vin | text | '' | |
| km | integer | - | |
| purchase_price | integer | - | Actual paid amount |
| purchased_at | timestamptz | now() | |
| evaluator_id | uuid | - | FK to profiles |
| notes | text | '' | |
| status | enum | in_stock | in_stock, sold, exported |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | Auto-updated |

**Indexes:**
- `idx_inventory_status` - Filter by status
- `idx_inventory_purchased_at` - Date sorting

**RLS:**
- Admins/managers can SELECT/INSERT/UPDATE
- Evaluators can SELECT only

---

#### evaluation_photos
Photos uploaded during evaluations.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| lead_id | uuid | - | FK to leads |
| evaluation_id | uuid | null | FK to evaluations |
| photo_url | text | - | Supabase Storage URL |
| caption | text | '' | Optional description |
| uploaded_by | uuid | - | FK to profiles |
| uploaded_at | timestamptz | now() | |

**Indexes:**
- `idx_evaluation_photos_lead_id` - Query by lead
- `idx_evaluation_photos_evaluation_id` - Query by evaluation

**RLS:**
- Admins/managers can SELECT all
- Evaluators can SELECT for assigned leads
- Evaluators can INSERT for assigned leads

---

### Configuration Tables

#### theme_config
UI customization (single row).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| primary_color | text | #0f172a | Hex color |
| background_color | text | #ffffff | Hex color |
| button_color | text | #0f172a | Hex color |
| logo_url | text | '' | Image URL |
| font_family | text | system-ui | CSS font-family |
| main_title | text | ... | Homepage title |
| main_subtitle | text | ... | Homepage subtitle |
| updated_at | timestamptz | now() | Auto-updated |

**RLS:**
- Public can SELECT (for app styling)
- Authenticated can SELECT
- Admins can UPDATE

---

#### app_settings
Email, SMS, and other configuration (single row).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| email_provider | text | resend | resend or sendgrid |
| email_api_key | text | '' | API key |
| email_from_address | text | info@autovaleur.ca | Sender |
| twilio_account_sid | text | '' | Twilio SID |
| twilio_auth_token | text | '' | Twilio token |
| twilio_from_number | text | '' | Twilio phone |
| sms_enabled | boolean | false | Toggle SMS |
| updated_at | timestamptz | now() | Auto-updated |

**RLS:**
- Admins can SELECT/UPDATE only

---

### Logging Tables

#### activity_log
System event logging.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | Primary key |
| event_type | text | - | lead_created, email_sent, etc. |
| event_data | jsonb | {} | Event details |
| user_id | uuid | null | FK to profiles |
| lead_id | uuid | null | FK to leads |
| created_at | timestamptz | now() | |

**Indexes:**
- `idx_activity_log_event_type` - Filter by type
- `idx_activity_log_created_at` - Date sorting
- `idx_activity_log_lead_id` - Query by lead

**RLS:**
- Admins can SELECT
- INSERT via service role only

---

## Enums

### user_role
```sql
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'evaluator');
```

### lead_status
```sql
CREATE TYPE lead_status AS ENUM (
  'NEW',
  'ASSIGNED',
  'VISIT_SCHEDULED',
  'EVALUATED',
  'OFFER_MADE',
  'BOUGHT',
  'LOST',
  'CANCELLED'
);
```

### inventory_status
```sql
CREATE TYPE inventory_status AS ENUM ('in_stock', 'sold', 'exported');
```

### evaluation_decision
```sql
CREATE TYPE evaluation_decision AS ENUM ('bought', 'lost');
```

---

## Common Queries

### Get all new leads
```sql
SELECT * FROM leads
WHERE status = 'NEW'
ORDER BY created_at DESC;
```

### Get leads by source
```sql
SELECT
  source_first,
  COUNT(*) as count,
  AVG(up_to) as avg_estimation
FROM leads
GROUP BY source_first
ORDER BY count DESC;
```

### Get evaluator performance
```sql
SELECT
  p.full_name,
  COUNT(l.id) as leads_assigned,
  COUNT(e.id) as leads_evaluated,
  SUM(CASE WHEN e.decision = 'bought' THEN 1 ELSE 0 END) as purchased,
  AVG(e.final_offer_price) as avg_final_price
FROM profiles p
LEFT JOIN leads l ON l.assigned_to = p.id
LEFT JOIN evaluations e ON e.evaluator_id = p.id
WHERE p.role = 'evaluator'
GROUP BY p.id, p.full_name;
```

### Get conversion funnel
```sql
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM leads
GROUP BY status
ORDER BY
  CASE status
    WHEN 'NEW' THEN 1
    WHEN 'ASSIGNED' THEN 2
    WHEN 'VISIT_SCHEDULED' THEN 3
    WHEN 'EVALUATED' THEN 4
    WHEN 'OFFER_MADE' THEN 5
    WHEN 'BOUGHT' THEN 6
    WHEN 'LOST' THEN 7
    WHEN 'CANCELLED' THEN 8
  END;
```

### Get recent activity
```sql
SELECT
  al.event_type,
  al.created_at,
  p.full_name as user_name,
  l.client_name,
  al.event_data
FROM activity_log al
LEFT JOIN profiles p ON al.user_id = p.id
LEFT JOIN leads l ON al.lead_id = l.id
ORDER BY al.created_at DESC
LIMIT 50;
```

---

## Relationships

### One-to-One
- `auth.users` → `profiles`
- `evaluations` → `inventory` (when bought)

### One-to-Many
- `profiles` → `leads` (assigned_to)
- `leads` → `evaluations`
- `leads` → `lead_notes`
- `leads` → `lead_status_history`
- `leads` → `evaluation_photos`
- `evaluations` → `evaluation_photos`
- `profiles` → `lead_notes` (created_by)
- `profiles` → `evaluations` (evaluator_id)

### No Direct Relationships
- `theme_config` (singleton)
- `app_settings` (singleton)
- `activity_log` (logging only)

---

## Storage Buckets

### evaluation-photos

**Purpose:** Store vehicle photos uploaded by evaluators

**Access:**
- Authenticated users can upload
- Authenticated users can read
- Public cannot access

**Create:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('evaluation-photos', 'evaluation-photos', false);

CREATE POLICY "Authenticated can upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'evaluation-photos');

CREATE POLICY "Authenticated can read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'evaluation-photos');
```

---

## Backup & Restore

### Backup
```bash
# Via Supabase CLI
supabase db dump > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
```

### Export Leads to CSV
```sql
COPY (
  SELECT * FROM leads ORDER BY created_at DESC
) TO '/tmp/leads.csv' WITH CSV HEADER;
```

---

## Migrations Applied

1. `create_autovaleur_schema` - All tables, enums, indexes, triggers
2. `create_rls_policies` - Security policies for all tables

**Location:** `supabase/migrations/`

---

**Schema Version:** V1.0
**Last Updated:** 2026-01-19
**Total Tables:** 10
**Total Indexes:** 15
**Total RLS Policies:** 27
