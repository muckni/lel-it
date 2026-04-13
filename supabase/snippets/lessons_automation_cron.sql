-- Schedule lessons operations automation jobs.
-- Run in Supabase SQL editor with pg_cron enabled.

select cron.schedule(
  'lessons-cycle-orchestrator-daily',
  '15 2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/lessons-cycle-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

select cron.schedule(
  'lessons-reminder-engine-daily',
  '30 2 * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/lessons-reminder-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
