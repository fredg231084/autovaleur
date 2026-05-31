/*
  # Workstream A — DB-backed rate limiting for `create-lead`

  ## Why
  The edge function currently rate-limits with an in-memory `Map`, which resets
  on every cold start and is not shared across instances — effectively no limit.
  This replaces it with a durable, shared store plus an atomic check function.

  ## Model
  - `rate_limits`: append-only log of attempts, keyed by an opaque `bucket`
    string (e.g. `ip:1.2.3.4` or `phone:+15145551234`).
  - `check_and_record_rate_limit(bucket, max_count, window_seconds)`:
      * counts attempts for `bucket` inside the trailing window,
      * returns FALSE (and records nothing extra) if at/over the limit,
      * otherwise records the attempt and returns TRUE.
    SECURITY DEFINER so it can run regardless of caller grants; in practice only
    the `create-lead` edge function (service role) calls it.

  ## Access
  RLS is enabled with NO policies: anon/authenticated get nothing. The service
  role used by the edge function bypasses RLS, so it can read/write freely.
  The function is intentionally NOT granted to anon/authenticated.
*/

CREATE TABLE IF NOT EXISTS rate_limits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket     text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_bucket_created
  ON rate_limits (bucket, created_at DESC);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (edge function) touches this.

CREATE OR REPLACE FUNCTION check_and_record_rate_limit(
  p_bucket         text,
  p_max_count      integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Opportunistic cleanup of rows well outside any window we care about.
  DELETE FROM rate_limits
  WHERE created_at < now() - make_interval(secs => p_window_seconds * 10);

  SELECT count(*) INTO recent_count
  FROM rate_limits
  WHERE bucket = p_bucket
    AND created_at > now() - make_interval(secs => p_window_seconds);

  IF recent_count >= p_max_count THEN
    RETURN false;  -- rate limited
  END IF;

  INSERT INTO rate_limits (bucket) VALUES (p_bucket);
  RETURN true;     -- allowed
END;
$$;

-- Deliberately NOT granted to anon/authenticated. Service role bypasses this.
REVOKE ALL ON FUNCTION check_and_record_rate_limit(text, integer, integer) FROM PUBLIC;
