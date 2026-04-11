-- Run once in your Supabase SQL editor to schedule the daily digest function.
-- Adjust timezone/window as needed.

select cron.schedule(
  'deadline-digest-daily',
  '0 6 * * *',
  $$
  select
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/deadline-digest',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
