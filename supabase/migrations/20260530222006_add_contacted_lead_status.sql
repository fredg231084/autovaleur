/*
  # Workstream A/C — Add `CONTACTED` to the `lead_status` enum (CRM status flip)

  ## Why
  The admin Leads screen (Workstream C) flips a lead through a simplified funnel:
    Nouveau (NEW) → Contacté (CONTACTED) → Acheté (BOUGHT) / Perdu (LOST)
  The live enum (from 20260119053221) has no value for "Contacté":
    'NEW','ASSIGNED','VISIT_SCHEDULED','EVALUATED','OFFER_MADE','BOUGHT','LOST','CANCELLED','PARTIAL'
  This adds it.

  ## Why this is its OWN migration file
  Postgres will not let you ADD a value to an enum and then USE that value in the
  same transaction. Isolating the `ADD VALUE` in its own migration guarantees it
  is committed before any later migration or application code references
  'CONTACTED'. Do NOT merge this with other DDL. (Same reason 'PARTIAL' got its
  own file in 222002.)
*/

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'CONTACTED';
