/*
  # Workstream A — Notifications: recipient + contact phone + canonical domain

  ## Why
  1. `create-lead` hardcodes the internal-notification recipient as
     `info@autovaleur.com`. The spec wants this pulled from `app_settings`, but
     `app_settings` has no such column today — only `email_from_address`. This
     migration adds `notify_email`.

  2. Domain standardization. The canonical domain is **autovaleur.com** (locked
     decision) and is the ONLY domain — there is nothing legitimate to preserve.
     We change the `email_from_address` DEFAULT to `.com` and FORCE every
     existing row to `.com` unconditionally.

  3. Contact phone. `create-lead` previously hardcoded a placeholder phone in
     emails/SMS. We add `contact_phone` (default 438-544-3600, the real Montréal
     number) so it lives in `app_settings` and is editable from the admin, the
     same way `notify_email` is. The edge function derives the `tel:` link by
     stripping non-digits, so only the display form is stored.

  ## Operational dependency (NOT handled here)
  `autovaleur.com` must be a verified sending domain in Resend (DNS records),
  or mail from the new `from` address will be rejected. Verify in the Resend
  dashboard before relying on this in production.

  ## Note
  The matching `.ca` mailto links in `src/App.tsx` are a frontend change, not a
  migration — handled separately.
*/

-- 1) New internal-notification recipient column.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS notify_email text DEFAULT 'info@autovaleur.com';

-- Backfill the existing config row(s) where it is unset.
UPDATE app_settings
  SET notify_email = 'info@autovaleur.com'
  WHERE notify_email IS NULL OR notify_email = '';

-- 2) Canonical domain on the "from" address. autovaleur.com is the only domain,
--    so force it unconditionally on every existing row.
ALTER TABLE app_settings
  ALTER COLUMN email_from_address SET DEFAULT 'info@autovaleur.com';

UPDATE app_settings
  SET email_from_address = 'info@autovaleur.com';

-- 3) Public-facing contact phone (shown in client emails / SMS), editable from
--    the admin. Store the display form; the edge function derives the tel: link.
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS contact_phone text DEFAULT '438-544-3600';

UPDATE app_settings
  SET contact_phone = '438-544-3600'
  WHERE contact_phone IS NULL OR contact_phone = '';
