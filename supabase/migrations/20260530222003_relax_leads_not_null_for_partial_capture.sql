/*
  # Workstream A — Relax NOT NULL on `leads` for PARTIAL early capture

  ## Why
  A PARTIAL lead is created at the gate with only the vehicle details (already
  collected in the previous step) plus name + phone. The booking-only fields are
  not known yet and would violate the original NOT NULL constraints, so a gate
  insert would fail.

  ## What stays NOT NULL (available at the gate)
    vehicle_year, vehicle_make, vehicle_model, km, drivable,
    client_name, client_phone
  (These are collected in the car-details step and the gate itself.)

  ## What becomes nullable (only known at the finish step)
    up_to                     -- server-derived estimate; may not exist yet for a PARTIAL
    postal_code
    slot_type
    selected_slot_id
    selected_slot_datetime
    client_email              -- email is optional / deferred per the funnel rework
    client_address

  ## Integrity guard (CHECK constraint)
  Relaxing NOT NULL must not let a *completed* lead slip through with missing
  data. A CHECK constraint enforces that the relaxed columns may be NULL ONLY
  while `status = 'PARTIAL'`. Any non-PARTIAL lead (NEW, ASSIGNED, … ) must have
  every one of them populated — the same guarantee the old NOT NULLs gave, but
  conditional on status. Depends on `'PARTIAL'` existing (added in 222002).

  ## Note
  This changes constraints only. The `create-lead` edge function (separate,
  non-migration change) branches on a partial-vs-complete mode and enforces the
  appropriate required fields per mode in application code.
*/

ALTER TABLE leads ALTER COLUMN up_to                  DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN postal_code            DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN slot_type              DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN selected_slot_id       DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN selected_slot_datetime DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN client_email           DROP NOT NULL;
ALTER TABLE leads ALTER COLUMN client_address         DROP NOT NULL;

-- A non-PARTIAL lead must have all the booking/finish fields. Only a PARTIAL
-- (early-capture) lead is allowed to leave them NULL.
ALTER TABLE leads
  ADD CONSTRAINT leads_complete_requires_all_fields
  CHECK (
    status = 'PARTIAL'
    OR (
          up_to                  IS NOT NULL
      AND postal_code            IS NOT NULL
      AND slot_type              IS NOT NULL
      AND selected_slot_id       IS NOT NULL
      AND selected_slot_datetime IS NOT NULL
      AND client_email           IS NOT NULL
      AND client_address         IS NOT NULL
    )
  );
