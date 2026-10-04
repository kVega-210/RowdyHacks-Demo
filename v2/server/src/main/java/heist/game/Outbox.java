package heist.game;

import java.util.Map;

/** Where the engine sends messages. Rooms implement this over WebSockets; tests capture it. */
public interface Outbox {
    void toPlayer(String playerId, Map<String, Object> msg);

    void toHosts(Map<String, Object> msg);

    /** Every phone and every host screen. */
    void toAll(Map<String, Object> msg);
}
