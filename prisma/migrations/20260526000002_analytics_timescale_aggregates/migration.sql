-- S7-12: Convert analytics_events to TimescaleDB hypertable with retention and continuous aggregates

SELECT create_hypertable(
  'analytics_events',
  'occurred_at',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

SELECT add_retention_policy(
  'analytics_events',
  drop_after => INTERVAL '12 months',
  if_not_exists => TRUE
);

-- Daily rollup: event counts per type per museum
CREATE MATERIALIZED VIEW analytics_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', occurred_at) AS bucket,
  museum_id,
  event_type,
  COUNT(*) AS event_count
FROM analytics_events
GROUP BY bucket, museum_id, event_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'analytics_daily',
  start_offset    => INTERVAL '3 days',
  end_offset      => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Weekly rollup: event counts per type per museum
CREATE MATERIALIZED VIEW analytics_weekly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('7 days', occurred_at) AS bucket,
  museum_id,
  event_type,
  COUNT(*) AS event_count
FROM analytics_events
GROUP BY bucket, museum_id, event_type
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
  'analytics_weekly',
  start_offset    => INTERVAL '14 days',
  end_offset      => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);
