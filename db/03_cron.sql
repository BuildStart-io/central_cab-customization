-- ============================================================================
-- 03_cron.sql — scheduled jobs for central_cab (safety net + follow-ups).
-- Tenant-isolated job names and suffixed function endpoints.
-- Requires pg_cron + pg_net. Run as superuser on your self-hosted Postgres.
--
-- Replace:
--   <FUNCTIONS_URL>  e.g. http://api-gw:8000/functions/v1   (inside docker)
--   <SERVICE_ROLE_KEY>
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-message-queue-central_cab') THEN
    PERFORM cron.unschedule('drain-message-queue-central_cab');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-followups-central_cab') THEN
    PERFORM cron.unschedule('send-followups-central_cab');
  END IF;

  -- Clean up any obsolete un-suffixed / old test job names if they exist
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'drain-central-cab-queue') THEN
    PERFORM cron.unschedule('drain-central-cab-queue');
  END IF;
END $$;

-- Queue drainer safety net for central_cab. webhook-wsender-central_cab already fires
-- process-message-central_cab immediately on each inbound message; this catches anything left behind.
SELECT cron.schedule(
  'drain-message-queue-central_cab',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := '<FUNCTIONS_URL>/process-message-central_cab',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{"trigger":"cron"}'::jsonb
  );
  $$
);

-- Inactivity & follow-ups for central_cab.
SELECT cron.schedule(
  'send-followups-central_cab',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := '<FUNCTIONS_URL>/send-followups-central_cab',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Inspect:  SELECT jobid, jobname, schedule FROM cron.job;
-- Remove:   SELECT cron.unschedule('drain-message-queue-central_cab');
