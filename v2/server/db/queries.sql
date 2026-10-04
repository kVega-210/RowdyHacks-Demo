-- DB-03: stats queries. The server runs the equivalent logic in heist.db.Stats so the same numbers
-- work with the JSONL fallback; these are the SQL versions for Tiger Data dashboards.

-- Leaderboard: final stash per player across all finished games.
SELECT e.room_id,
       s->>'name'              AS name,
       (s->>'stash')::bigint   AS stash,
       (s->>'rank')::int       AS rank,
       e.ts                    AS finished_at
FROM events e,
     jsonb_array_elements(e.payload->'standings') AS s
WHERE e.event_type = 'game_end'
ORDER BY stash DESC
LIMIT 20;

-- Per player stats in one room.
SELECT player_id,
       count(*) FILTER (WHERE event_type = 'minigame_result' AND (payload->>'success')::boolean)     AS successes,
       count(*) FILTER (WHERE event_type = 'minigame_result' AND NOT (payload->>'success')::boolean) AS fails,
       count(*) FILTER (WHERE event_type = 'steal')                                                  AS steals,
       coalesce(sum((payload->>'amount')::bigint) FILTER (WHERE event_type = 'steal'), 0)          AS stolen,
       count(*) FILTER (WHERE event_type = 'freeze_violation')                                       AS freeze_violations
FROM events
WHERE room_id = $1 AND player_id IS NOT NULL
GROUP BY player_id;

-- Cash-over-time series for the replay page (every event carrying a wallet value).
SELECT ts, round, player_id, event_type, (payload->>'wallet')::bigint AS wallet, (payload->>'bank')::bigint AS bank
FROM events
WHERE room_id = $1 AND payload ? 'wallet'
ORDER BY ts;

-- Bank drain per minute, using Timescale's time_bucket.
SELECT time_bucket('1 minute', ts) AS minute, room_id, sum((payload->>'amount')::bigint) AS drawn
FROM events
WHERE event_type = 'bank_draw'
GROUP BY minute, room_id
ORDER BY minute DESC;
