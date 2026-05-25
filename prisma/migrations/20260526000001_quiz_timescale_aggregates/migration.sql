-- S6-05: Convert quiz_sessions to a TimescaleDB hypertable and create
--        continuous aggregates for weekly / monthly leaderboards.

-- 1. Hypertable conversion (migrate_data retains existing rows)
SELECT create_hypertable(
  'quiz_sessions',
  'created_at',
  if_not_exists     => TRUE,
  migrate_data      => TRUE,
  chunk_time_interval => INTERVAL '7 days'
);

-- 2. Weekly continuous aggregate — best score per (user, museum) in 7-day buckets
CREATE MATERIALIZED VIEW quiz_leaderboard_weekly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('7 days'::INTERVAL, created_at) AS bucket,
  museum_id,
  user_id,
  MAX(total_score)  AS best_score,
  COUNT(*)          AS quiz_count
FROM quiz_sessions
WHERE user_id IS NOT NULL
  AND completed_at IS NOT NULL
GROUP BY bucket, museum_id, user_id
WITH NO DATA;

-- 3. Monthly continuous aggregate — best score per (user, museum) in 30-day buckets
CREATE MATERIALIZED VIEW quiz_leaderboard_monthly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('30 days'::INTERVAL, created_at) AS bucket,
  museum_id,
  user_id,
  MAX(total_score)  AS best_score,
  COUNT(*)          AS quiz_count
FROM quiz_sessions
WHERE user_id IS NOT NULL
  AND completed_at IS NOT NULL
GROUP BY bucket, museum_id, user_id
WITH NO DATA;

-- 4. Hourly refresh policies
SELECT add_continuous_aggregate_policy(
  'quiz_leaderboard_weekly',
  start_offset      => INTERVAL '14 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);

SELECT add_continuous_aggregate_policy(
  'quiz_leaderboard_monthly',
  start_offset      => INTERVAL '60 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
