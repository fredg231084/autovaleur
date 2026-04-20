# AutoValeur V1 - Production-Ready Booking + CRM System

## Overview

AutoValeur is a complete vehicle booking and CRM system with:
- Public booking app (app.autovaleur.ca) - Allows clients to get instant estimates and book home evaluations
- CRM portal (crm.autovaleur.ca) - Manage leads, evaluators, inventory, and analytics
- Internal tracking system - Capture source attribution without depending on Google Analytics
- Email/SMS notifications - Automated communications via Resend/SendGrid and Twilio

## What's Been Built

### ✅ Completed

#### 1. Database Schema
- **10 tables** with complete relationships
- **RLS policies** for role-based access (admin, manager, evaluator)
- **Status tracking** with timestamps for KPIs
- **Activity logging** for troubleshooting

Tables:
- `profiles` - User roles and info
- `leads` - Core lead/booking table with full tracking
- `lead_status_history` - Timeline of changes
- `lead_notes` - Internal notes
- `evaluations` - Evaluation details
- `inventory` - Purchased vehicles
- `evaluation_photos` - Photo uploads
- `theme_config` - UI customization
- `app_settings` - Email/SMS configuration
- `activity_log` - Event logging

#### 2. Edge Functions
- **create-lead** - Handles lead creation with:
  - Validation
  - Honeypot anti-spam
  - Rate limiting (3 requests/minute per IP)
  - Email notifications (client + internal)
  - SMS notifications (optional, Twilio)
  - Activity logging

#### 3. Tracking System
- **First-touch attribution** stored in database
- **Session management** (30-minute sessions)
- **Source classification**:
  - UTM parameters
  - Custom query params (source, cta, lp)
  - Referrer-based classification
  - Enhanced for Google Ads, Facebook Ads
- **Conversion context** (CTA, entry page, app URL)

#### 4. Public App Foundation
- AutoValeurWidget component (premium UX)
- Tracking utilities integrated
- API client for lead submission
- Supabase client setup

### 🔨 To Build (See IMPLEMENTATION_PLAN.md)

1. **Connect Widget to API** - Integrate form submission
2. **CRM App** - Full admin portal
3. **Deployment** - Two Vercel projects

## Project Structure

```
/
├── src/                          # Public app (app.autovaleur.ca)
│   ├── App.tsx                   # Main widget component
│   ├── main.tsx                  # Entry point with tracking init
│   ├── lib/
│   │   ├── tracking.ts           # ✅ Source attribution
│   │   ├── supabase.ts           # ✅ Supabase client
│   │   └── api.ts                # ✅ API client
│   └── index.css                 # Tailwind styles
│
├── packages/shared/              # Shared utilities
│   └── src/
│       ├── types.ts              # ✅ TypeScript types
│       └── tracking.ts           # ✅ Tracking (reference)
│
├── supabase/
│   └── functions/
│       └── create-lead/          # ✅ Lead creation + notifications
│
├── DEPLOYMENT_GUIDE.md          # ✅ Full deployment instructions
├── IMPLEMENTATION_PLAN.md       # ✅ Step-by-step build guide
└── README.md                    # This file
```

## Environment Setup

Create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Connect Widget to API

Update `src/App.tsx` - Find the `submit` function and integrate:

```typescript
import { submitLead } from './lib/api';

async function submit(e: React.FormEvent) {
  e.preventDefault();

  // ... existing validation ...

  try {
    setSubmitting(true);

    const leadData = {
      vehicle_year: year,
      vehicle_make: make,
      vehicle_model: model,
      vin: vin,
      km: km,
      drivable: drivable === 'oui',
      up_to: upTo,
      postal_code: postal,
      slot_type: slotType,
      selected_slot_id: selectedSlotId,
      selected_slot_datetime: selectedSlot?.start.toISOString() || '',
      client_name: name,
      client_phone: phone,
      client_email: email,
      client_address: address,
      payment_preference: payPref,
      terms_accepted: termsAccepted,
      inspection_accepted: inspectionAccepted,
      marketing_opt_in: marketingOptIn,
    };

    await submitLead(leadData);
    setSubmitted(true);
  } catch (error) {
    console.error('Submission failed:', error);
    alert('Une erreur est survenue. Veuillez réessayer.');
  } finally {
    setSubmitting(false);
  }
}
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Test Full Flow

1. Open http://localhost:5173
2. Fill out the form
3. Check browser console for tracking data
4. Submit the form
5. Verify lead created in Supabase
6. Check email inbox (client + info@autovaleur.ca)

## Database Management

### View Leads

```sql
SELECT * FROM leads ORDER BY created_at DESC LIMIT 10;
```

### View Activity Log

```sql
SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20;
```

### Create Admin User

After signing up via CRM:

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = 'your-user-id';
```

## CRM Development

See `IMPLEMENTATION_PLAN.md` for complete CRM build guide.

### Quick CRM Overview

The CRM needs:
1. **Authentication** - Supabase Auth with role-based access
2. **Layout** - Sidebar navigation
3. **Dashboard** - KPIs and metrics
4. **Leads Management** - List, detail, filters
5. **Evaluator Views** - "My Visits" screen
6. **Settings** - Theme, email, SMS config
7. **Inventory** - Purchased vehicles

### CRM Tech Stack
- React + TypeScript
- React Router for routing
- Supabase for auth + data
- Tailwind CSS for styling
- Lucide React for icons

## Deployment

### Public App (app.autovaleur.ca)

1. Create Vercel project
2. Set root directory to `/` (current structure)
3. Add environment variables
4. Deploy
5. Add custom domain
6. Add noindex headers

### CRM App (crm.autovaleur.ca)

1. Build CRM first (see IMPLEMENTATION_PLAN.md)
2. Create separate Vercel project
3. Set root directory to `/crm-app`
4. Add environment variables
5. Deploy
6. Add custom domain
7. Add noindex + auth redirect headers

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## API Reference

### Edge Function: create-lead

**Endpoint:** `https://your-project.supabase.co/functions/v1/create-lead`

**Method:** POST

**Payload:**
```typescript
{
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vin: string;
  km: number;
  drivable: boolean;
  up_to: number;
  postal_code: string;
  slot_type: string;
  selected_slot_id: string;
  selected_slot_datetime: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  client_address: string;
  payment_preference: 'cash' | 'interac';
  terms_accepted: boolean;
  inspection_accepted: boolean;
  marketing_opt_in: boolean;
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
  honeypot?: string; // Anti-spam
}
```

**Response:**
```typescript
{
  success: boolean;
  data?: { lead_id: string };
  error?: string;
}
```

## Tracking System

### How It Works

1. **First Visit** - Captures:
   - UTM parameters (utm_source, utm_campaign, etc.)
   - Custom params (source, cta, lp)
   - Referrer
   - Landing page
   - Timestamp

2. **Session Tracking** - Data locked for 30 minutes

3. **Source Classification**:
   - `google_ads` - Google with utm_medium=cpc/ppc
   - `facebook_ads` - Facebook with paid medium
   - `organic` - Search engines without paid medium
   - `referral` - Social media, other sites
   - `direct` - No referrer

4. **Conversion Context** - Captured at submission:
   - CTA clicked (from URL)
   - Entry page
   - Full URL

### Testing Tracking

```javascript
// In browser console
import { debugTracking } from './lib/tracking';
debugTracking(); // Shows current tracking data
```

### URL Examples

```
# Google Ads
https://app.autovaleur.ca?utm_source=google&utm_medium=cpc&utm_campaign=spring2024

# Facebook Ads
https://app.autovaleur.ca?utm_source=facebook&utm_medium=paid&utm_content=carousel

# Custom CTA
https://app.autovaleur.ca?cta=hero_button&lp=homepage

# Combined
https://app.autovaleur.ca?utm_source=google&utm_medium=cpc&cta=cta_above_fold
```

## Email Configuration

### Resend (Recommended)

1. Sign up at resend.com
2. Verify domain
3. Get API key
4. In CRM Settings:
   - Provider: `resend`
   - API Key: `re_xxxxx`
   - From: `info@autovaleur.ca`

### SendGrid

1. Sign up at sendgrid.com
2. Verify domain
3. Get API key
4. In CRM Settings:
   - Provider: `sendgrid`
   - API Key: `SG.xxxxx`
   - From: `info@autovaleur.ca`

## SMS Configuration (Optional)

### Twilio

1. Sign up at twilio.com
2. Get phone number
3. Get Account SID + Auth Token
4. In CRM Settings:
   - Account SID: `ACxxxxx`
   - Auth Token: `xxxxx`
   - From Number: `+15145551234`
   - Enable: ON

## Security

### RLS Policies

- **Public**: Can only INSERT leads
- **Authenticated**: Role-based access
- **Admin**: Full access
- **Manager**: Can view/edit leads, assign evaluators
- **Evaluator**: Can only see assigned leads

### Anti-Spam

- Honeypot field (hidden input)
- Rate limiting (3 requests/minute per IP)
- Email validation
- Required consents

### Data Safety

- No DROP operations
- All destructive operations require confirmation
- Activity log for audit trail
- Automatic backups (Supabase)

## Troubleshooting

### Lead not created

1. Check browser console for errors
2. Check Edge Function logs in Supabase
3. Verify environment variables
4. Check activity_log table

### Email not sent

1. Verify API key in app_settings
2. Check activity_log for email_sent events
3. Confirm from address is verified
4. Check email provider dashboard

### Tracking not working

1. Check localStorage for 'av_tracking'
2. Open browser console
3. Verify tracking initialized in main.tsx
4. Check URL parameters

### RLS blocking queries

1. Verify user role in profiles table
2. Check RLS policies match role
3. Use service role key for debugging (careful!)

## Next Steps

1. ✅ Database schema created
2. ✅ Edge Functions deployed
3. ✅ Tracking system integrated
4. 🔨 Connect widget to API (see above)
5. 🔨 Test full lead flow
6. 🔨 Build CRM app (see IMPLEMENTATION_PLAN.md)
7. 🔨 Deploy to Vercel
8. 🔨 Configure email/SMS
9. 🔨 Go live!

## Support

For questions or issues:
- Check `activity_log` table
- Check Supabase Edge Function logs
- Check browser console
- Review IMPLEMENTATION_PLAN.md
- Review DEPLOYMENT_GUIDE.md

---

**Built with:** React, TypeScript, Vite, Tailwind CSS, Supabase, Vercel

**Status:** V1 Foundation Complete - Ready for integration and CRM build

Good luck! 🚀
