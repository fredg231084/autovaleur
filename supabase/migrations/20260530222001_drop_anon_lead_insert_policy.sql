/*
  # Workstream A — Security: remove the public anon INSERT hole on `leads`

  ## Why
  `20260119053315_create_rls_policies.sql` created:

      CREATE POLICY "Public can create leads"
        ON leads FOR INSERT TO anon WITH CHECK (true);

  This lets anyone holding the public anon key write arbitrary rows directly,
  bypassing the `create-lead` edge function's validation, rate limiting, and
  notifications. All legitimate inserts already go through `create-lead`, which
  uses the SERVICE ROLE key (bypasses RLS), so this policy is unnecessary.

  ## Effect
  After this migration, anon can no longer INSERT into `leads`. The edge
  function is unaffected (service role ignores RLS).
*/

DROP POLICY IF EXISTS "Public can create leads" ON leads;
