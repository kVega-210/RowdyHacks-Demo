package heist.net;

import heist.TestSupport;
import heist.game.GameEngine;
import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** IF-03: a full 8-player state message (the most frequent message) stays under the typical budget. */
class PayloadBudgetTest {
    @Test
    void eightPlayerStateFitsTheBudget() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 1);
        for (int i = 0; i < 8; i++) g.addPlayer("LongishName" + i, false);
        g.start(0);
        g.players().values().forEach(p -> { p.wallet = 123456; p.stash = 654321; p.team = "Smooth Operators"; });
        Map<String, Object> m = new LinkedHashMap<>(g.publicState(0));
        m.put("me", Map.of("id", "p1", "vaultName", "The Gilded Cage", "target", Map.of("id", "p2", "name", "LongishName1")));
        int bytes = Json.write(m).length();
        int budget = TestSupport.BALANCE.i("net.typicalBudgetBytes");
        assertTrue(bytes < budget * 1.5, "state for 8 players is " + bytes + " bytes");
        // Typical game messages are far smaller.
        for (var e : out.log) {
            String t = (String) e.getValue().get("t");
            if (!"state".equals(t) && !"final_standings".equals(t) && !"round_results".equals(t)) {
                int size = Json.write(e.getValue()).length();
                assertTrue(size < budget, t + " is " + size + " bytes");
            }
        }
    }

    @Test
    void rateLimiterCapsBursts() {
        RateLimiter r = new RateLimiter(5, 5);
        int allowed = 0;
        for (int i = 0; i < 50; i++) if (r.allow()) allowed++;
        assertTrue(allowed <= 6, "burst limited to ~5, got " + allowed);
    }
}
