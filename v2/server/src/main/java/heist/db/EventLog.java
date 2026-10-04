package heist.db;

import java.util.Map;

/** DB-02: fire-and-forget game event sink. Implementations must never block or throw into gameplay. */
public interface EventLog {
    void log(String roomId, int round, String playerId, String type, Map<String, Object> payload);

    EventLog NOOP = (r, n, p, t, d) -> { };
}
