/*
  # Workstream A — Add `PARTIAL` to the `lead_status` enum (early capture)

  ## Why
  The gate (Workstream B) creates a lead with only name + phone the moment the
  user asks to see the price ("early capture"), then enriches the SAME row to
  `NEW` at the end of the funnel. That early row needs a status the rest of the
  system recognizes as "not a complete booking yet": `PARTIAL`.

  ## Why this is its OWN migration file
  Postgres will not let you ADD a value to an enum and then USE that value in
  the same transaction. Isolating the `ADD VALUE` in its own migration
  guarantees it is committed before any later migration or application code
  references `'PARTIAL'`. Do NOT merge this with other DDL.

  Existing enum (from 20260119053221):
    'NEW','ASSIGNED','VISIT_SCHEDULED','EVALUATED','OFFER_MADE','BOUGHT','LOST','CANCELLED'
*/

ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'PARTIAL';
