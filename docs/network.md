# Network resilience and payload budget (IF-03)

Venue Wi-Fi will be bad. What the server and clients do about it:

- **Heartbeat**: clients `ping` every 10s (`net.heartbeatMs`); Javalin also sends WebSocket pings. A socket silent
  for 25s (`net.staleMs`) is closed by the server; the client notices 3 missed beats and reconnects.
- **Reconnect**: exponential backoff (300ms doubling, max 5s, jitter), then `resume` with the stored token restores
  phase, wallet, stash, key, the current minigame attempt and any open steal/freeze/raid/vote (BE-02).
- **Update cap**: `state` is the only frequent message and is throttled to 8Hz (`net.maxStateHz`), only when
  something changed. Everything else is event-driven.
- **Payload budget**: typical messages are 60-400 bytes; an 8-player `state` is ~950 bytes. `PayloadBudgetTest`
  enforces it and `GET /api/net/stats` shows live count/avg/max bytes per message type.
- **Back-pressure**: each connection has its own send queue drained on a virtual thread, so one slow phone never
  blocks the room; a queue over 500 messages drops that connection (it will resume).
- **Rate limits**: 20 intents/s and 8 scans/s per connection.

Manual throttled test: Chrome DevTools > Network > "Slow 3G" on a phone tab, play a round, toggle "Offline" for
10s mid-round and back: the phone shows "Reconnecting..." and resumes into the same attempt.
