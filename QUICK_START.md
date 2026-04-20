# Quick Start - Connect Widget to API

This guide shows you how to connect the existing AutoValeur widget to the backend in **under 30 minutes**.

## Prerequisites

- Node.js installed
- Supabase project with migrations applied
- Edge Function deployed (already done)

## Step 1: Environment Variables (2 minutes)

Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from:
- Supabase Dashboard → Settings → API

## Step 2: Update App.tsx (10 minutes)

Open `src/App.tsx` and add the import at the top:

```typescript
import { submitLead } from './lib/api';
```

Find the `submit` function (around line 400+) and replace the TODO comment with:

```typescript
async function submit(e: React.FormEvent) {
  e.preventDefault();
  const v = validateStep(5);
  setErrors(v);

  if (Object.keys(v).length) {
    const r = firstErrorRef(v);
    if (r) scrollToRef(r);
    return;
  }

  // NEW CODE: Submit to API
  try {
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
  }
}
```

**That's it!** The widget now connects to your backend.

## Step 3: Test Locally (5 minutes)

```bash
# Install dependencies (if not already done)
npm install

# Start dev server
npm run dev
```

Open http://localhost:5173

1. Fill out the form
2. Click through all steps
3. Submit

**Check:**
- Browser console (should see no errors)
- Supabase Dashboard → Table Editor → leads (new row)
- Email inbox (client + internal emails)

## Step 4: Configure Email (Optional, 5 minutes)

If emails aren't sending:

1. Sign up at [Resend](https://resend.com) (free tier)
2. Get API key
3. In Supabase, run:

```sql
UPDATE app_settings
SET
  email_provider = 'resend',
  email_api_key = 're_your_key_here',
  email_from_address = 'info@autovaleur.ca'
WHERE id = (SELECT id FROM app_settings LIMIT 1);
```

4. Test again - emails should send

## Step 5: Deploy (10 minutes)

### Via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY

# Deploy to production
vercel --prod
```

### Via Vercel Dashboard

1. Go to vercel.com
2. Import Git repository
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## Step 6: Add Custom Domain (5 minutes)

In Vercel project settings:

1. Domains → Add Domain
2. Enter: `app.autovaleur.ca`
3. Follow DNS instructions
4. Wait for DNS propagation (5-30 minutes)

## Step 7: Add noindex Header

Create `vercel.json` in project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Robots-Tag",
          "value": "noindex, nofollow"
        }
      ]
    }
  ]
}
```

Commit and redeploy.

## Verification Checklist

- [ ] Form submits without errors
- [ ] Lead appears in Supabase `leads` table
- [ ] Tracking data captured (source_first, etc.)
- [ ] Client email sent
- [ ] Internal email sent (info@autovaleur.ca)
- [ ] Success screen shows
- [ ] Build succeeds (`npm run build`)
- [ ] Deployed to Vercel
- [ ] Custom domain works
- [ ] noindex header present

## Troubleshooting

### "Network Error" on submit

**Issue:** CORS or Edge Function not responding

**Fix:**
- Check Edge Function is deployed: Supabase Dashboard → Edge Functions
- Verify `VITE_SUPABASE_URL` in .env
- Check browser console for details

### Lead created but no email

**Issue:** Email settings not configured

**Fix:**
```sql
-- Check current settings
SELECT * FROM app_settings;

-- Update with Resend key
UPDATE app_settings
SET
  email_provider = 'resend',
  email_api_key = 're_xxxxx',
  email_from_address = 'info@autovaleur.ca';
```

### "Failed to create lead"

**Issue:** Validation error or database issue

**Fix:**
- Check Edge Function logs: Supabase → Edge Functions → create-lead → Logs
- Check `activity_log` table for errors
- Verify RLS policies allow INSERT

### Tracking showing "unknown"

**Issue:** Tracking not initialized

**Fix:**
- Check `src/main.tsx` has `initializeTracking()` call
- Clear browser cache and try again
- Check browser console for errors

## What's Next?

### Option 1: Start Collecting Leads

You're done! The public app is live and working.

- Share the link: https://app.autovaleur.ca
- Monitor leads in Supabase
- Create admin user for future CRM access

### Option 2: Build CRM Now

Follow `IMPLEMENTATION_PLAN.md` to build the CRM portal.

**Estimated time:** 2-3 days

### Option 3: Customize Theme

```sql
-- Update theme config
UPDATE theme_config
SET
  primary_color = '#0f172a',
  button_color = '#0f172a',
  main_title = 'Your Custom Title',
  main_subtitle = 'Your Custom Subtitle';
```

Reload app to see changes.

## Testing Tracking

### Test Organic Search

```
https://app.autovaleur.ca
(no parameters)
```

**Expected:** `source_first = 'direct'`

### Test Google Ads

```
https://app.autovaleur.ca?utm_source=google&utm_medium=cpc&utm_campaign=test
```

**Expected:** `source_first = 'google_ads'`

### Test Facebook Ads

```
https://app.autovaleur.ca?utm_source=facebook&utm_medium=paid&utm_campaign=test
```

**Expected:** `source_first = 'facebook_ads'`

### Test Custom CTA

```
https://app.autovaleur.ca?cta=hero_button&lp=homepage
```

**Expected:** `cta = 'hero_button'`, `entry_page = 'homepage'`

Check tracking in database:

```sql
SELECT
  client_name,
  source_first,
  campaign_first,
  cta,
  entry_page,
  created_at
FROM leads
ORDER BY created_at DESC
LIMIT 10;
```

## Production Checklist

Before going live:

- [ ] Test form on mobile
- [ ] Test form on desktop
- [ ] Test all validation errors
- [ ] Verify emails send correctly
- [ ] Check email spam folder (whitelist domain)
- [ ] Test with real phone number (SMS if enabled)
- [ ] Verify lead data in database is complete
- [ ] Test tracking with different sources
- [ ] Check Edge Function logs for errors
- [ ] Set up monitoring (Supabase Dashboard)
- [ ] Document admin credentials securely
- [ ] Plan CRM build timeline

## Support

If stuck:

1. Check browser console for errors
2. Check Edge Function logs in Supabase
3. Check `activity_log` table in database
4. Review README.md for detailed troubleshooting
5. Check Supabase status page

---

**Time from zero to deployed:** ~30 minutes

**You now have a live booking system accepting leads!** 🎉

Next step: Build the CRM to manage those leads (see IMPLEMENTATION_PLAN.md)
