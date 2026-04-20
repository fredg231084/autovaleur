# AutoValeur V1 - Deployment Guide

## Architecture Overview

### Mono-Repo Structure
```
/
├── apps/
│   ├── public/          # app.autovaleur.ca (public booking)
│   └── crm/             # crm.autovaleur.ca (CRM portal)
├── packages/
│   └── shared/          # Shared types, utilities, configs
├── supabase/
│   └── functions/       # Edge Functions
└── DEPLOYMENT_GUIDE.md
```

### Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage (for evaluation photos)
- **Hosting**: Vercel (two projects)
- **Email**: Resend or SendGrid (configurable)
- **SMS**: Twilio (optional, configurable)

## Database Setup

### 1. Supabase Project
The database schema and RLS policies have already been created via migrations:
- ✅ `create_autovaleur_schema` - All tables, enums, indexes
- ✅ `create_rls_policies` - Security policies for all roles

### 2. Create Admin User
After deployment, you need to create the first admin user:

```sql
-- 1. Sign up via the CRM app (creates auth.user + profile with role='evaluator')
-- 2. Promote to admin:
UPDATE profiles
SET role = 'admin'
WHERE id = '<your-user-id>';
```

### 3. Storage Bucket
Create a storage bucket for evaluation photos:

```sql
-- Via Supabase Dashboard > Storage > Create bucket
-- Name: evaluation-photos
-- Public: false

-- Or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('evaluation-photos', 'evaluation-photos', false);

-- Policy: Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'evaluation-photos');

-- Policy: Allow authenticated users to read photos
CREATE POLICY "Authenticated users can read photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'evaluation-photos');
```

## Vercel Deployment

### Option 1: Two Separate Projects (Recommended)

#### Project 1: Public App (app.autovaleur.ca)
1. Create new Vercel project
2. Set Root Directory: `apps/public`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

**Environment Variables:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Domain Settings:**
- Add custom domain: `app.autovaleur.ca`
- Add headers in `vercel.json`:
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

#### Project 2: CRM App (crm.autovaleur.ca)
1. Create new Vercel project from same repo
2. Set Root Directory: `apps/crm`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

**Environment Variables:**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Domain Settings:**
- Add custom domain: `crm.autovaleur.ca`
- Add headers in `vercel.json`:
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
    ],
    "redirects": [
      {
        "source": "/(.*)",
        "has": [
          {
            "type": "header",
            "key": "x-vercel-ip-country"
          }
        ],
        "missing": [
          {
            "type": "cookie",
            "key": "sb-access-token"
          }
        ],
        "destination": "/login",
        "permanent": false
      }
    ]
  }
  ```

### Option 2: Mono-Repo with Path-Based Routing
If you prefer a single Vercel project:
1. Use Vercel's multi-app support
2. Configure `vercel.json` to route by subdomain
3. More complex but manageable

## Edge Functions Setup

### Deploy Functions
```bash
# Deploy lead creation function
npm run deploy:function -- create-lead

# Deploy email notification function
npm run deploy:function -- send-email

# Deploy SMS notification function (optional)
npm run deploy:function -- send-sms
```

### Function Environment Variables
Edge Functions automatically have access to:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

No manual configuration needed!

## Post-Deployment Configuration

### 1. Email Setup (Resend or SendGrid)
1. Log in to CRM as admin
2. Go to Settings > Email Configuration
3. Enter:
   - Provider: `resend` or `sendgrid`
   - API Key: Your API key
   - From Address: `info@autovaleur.ca`

### 2. SMS Setup (Optional - Twilio)
1. Log in to CRM as admin
2. Go to Settings > SMS Configuration
3. Enter:
   - Account SID
   - Auth Token
   - From Number
   - Enable SMS: Toggle ON

### 3. Theme Configuration
1. Go to Settings > Theme
2. Customize:
   - Primary Color
   - Logo URL
   - Main Title/Subtitle
3. Changes apply instantly to public app

## Security Checklist

- ✅ RLS enabled on all tables
- ✅ Policies enforce role-based access
- ✅ Public app can only INSERT leads
- ✅ CRM requires authentication
- ✅ Sensitive keys stored in Edge Functions
- ✅ No API keys in frontend code
- ✅ noindex headers on both subdomains
- ✅ HTTPS enforced

## Monitoring & Troubleshooting

### Activity Log
All key events are logged in `activity_log` table:
- Lead created
- Email sent
- SMS sent
- Status changed
- User actions

Query recent events:
```sql
SELECT * FROM activity_log
ORDER BY created_at DESC
LIMIT 100;
```

### Common Issues

**Lead not created:**
- Check Edge Function logs in Supabase
- Verify honeypot field is empty
- Check rate limiting

**Email not sent:**
- Verify API key in app_settings
- Check activity_log for errors
- Confirm from address is verified in email provider

**SMS not sent:**
- Verify Twilio credentials in app_settings
- Check SMS is enabled
- Confirm phone number format

## Backup & Recovery

### Database Backups
Supabase automatically backs up your database. Additional manual backups:
```bash
# Via Supabase CLI (not installed by default)
supabase db dump > backup.sql
```

### Restore from Backup
```bash
# Via Supabase Dashboard > Database > Restore
# Or via CLI:
psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
```

## Performance Optimization

### Indexes
All critical indexes are already created:
- `idx_leads_status` - For filtering by status
- `idx_leads_assigned_to` - For evaluator queries
- `idx_leads_created_at` - For date sorting
- `idx_leads_source_first` - For analytics

### Caching
- Theme config is cached in localStorage (public app)
- Lead lists use pagination (CRM)

## Support & Maintenance

### Regular Tasks
- [ ] Review activity_log weekly
- [ ] Monitor lead conversion rates
- [ ] Update theme seasonally
- [ ] Backup database monthly
- [ ] Review user roles quarterly

### Scaling Considerations
V1 is designed for simplicity. When you outgrow it:
- Add Redis for caching
- Implement queue system for emails
- Add CDN for static assets
- Consider dedicated email service
- Implement advanced analytics

## Next Steps

1. Deploy both apps to Vercel
2. Create admin user
3. Configure email provider
4. Test full lead flow
5. Configure theme
6. Add team members
7. Go live!

---

**Questions?** Check the codebase comments or activity_log for troubleshooting.
