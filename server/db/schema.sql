-- DB-01: HEIST HAVOC! append-only event log for Tiger Data (TimescaleDB / Postgres).
-- Safe to run repeatedly (the server runs it on startup when DATABASE_URL is set; or use scripts/db-migrate.sh).

CREATE TABLE IF NOT EXISTS events (
    ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
    room_id     TEXT        NOT NULL,
    round       INTEGER     NOT NULL DEFAULT 0,
    player_id   TEXT,
    event_type  TEXT        NOT NULL,
    payload     JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- Turn it into a hypertable when the TimescaleDB extension is available (Tiger Data has it).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb') THEN
        CREATE EXTENSION IF NOT EXISTS timescaledb;
        PERFORM create_hypertable('events', 'ts', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day');
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS events_room_ts_idx ON events (room_id, ts DESC);
CREATE INDEX IF NOT EXISTS events_type_ts_idx ON events (event_type, ts DESC);
CREATE INDEX IF NOT EXISTS events_player_idx ON events (player_id, ts DESC) WHERE player_id IS NOT NULL;
