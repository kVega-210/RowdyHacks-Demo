package heist.game;

import heist.TestSupport;
import heist.util.Clock;
import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StealArbiterTest {

    @Test
    void firstValidScanWinsAndEverythingAfterIsRejected() {
        StealArbiter s = new StealArbiter(1000, 7000);
        PlayerState a = new PlayerState("a", "A", 1, false), b = new PlayerState("b", "B", 2, false), c = new PlayerState("c", "C", 3, false);
        assertEquals(StealArbiter.Reject.CLOSED, s.scan(a, b, 999).reject());
        assertEquals(StealArbiter.Reject.OWN_KEY, s.scan(a, a, 1500).reject());
        assertEquals(StealArbiter.Reject.UNKNOWN_KEY, s.scan(a, null, 1500).reject());
        assertTrue(s.scan(c, b, 1600).won());
        assertEquals("c", s.winner());
        assertEquals(StealArbiter.Reject.ALREADY_WON, s.scan(a, b, 1601).reject());
        assertEquals(StealArbiter.Reject.ALREADY_WON, s.scan(b, a, 1602).reject());
        assertFalse(s.isOpen(1700));
    }

    @Test
    void alreadyStolenKeyCannotBeStolenAgain() {
        StealArbiter s = new StealArbiter(0, 100);
        PlayerState a = new PlayerState("a", "A", 1, false), b = new PlayerState("b", "B", 2, false);
        b.keyStolen = true;
        assertEquals(StealArbiter.Reject.KEY_ALREADY_STOLEN, s.scan(a, b, 10).reject());
        assertNull(s.winner());
    }

    /** BE-07 done-when: 6 bots spamming scans produce exactly one winner per window. */
    @Test
    void sixPlayersSpammingScansGetExactlyOneWinnerPerWindow() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 7);
        List<PlayerState> ps = new ArrayList<>();
        for (int i = 0; i < 6; i++) ps.add(g.addPlayer("P" + i, false));
        Clock.Manual clock = new Clock.Manual(1_000_000);
        g.start(clock.now());
        while (g.phase() != Phase.PLAY) {
            clock.advance(100);
            g.tick(clock.now());
        }
        int windows = 0;
        for (int w = 0; w < 25; w++) {
            g.openForTest(EventScheduler.Kind.STEAL, clock.now());
            windows++;
            // Every player spams scans at every other player's key, interleaved.
            for (int burst = 0; burst < 10; burst++) {
                for (PlayerState scanner : ps) {
                    PlayerState victim = ps.get((ps.indexOf(scanner) + 1 + burst) % ps.size());
                    g.handle(scanner.id, Json.MAPPER.valueToTree(Map.of("t", "key_scan", "victim", victim.id)), clock.now());
                }
                clock.advance(5);
            }
            clock.advance(TestSupport.BALANCE.l("steal.windowMs"));
            g.tick(clock.now());
            // Reset keys so later windows have victims (normally done at round end).
            g.players().values().forEach(p -> p.keyStolen = false);
        }
        assertEquals(windows, out.of("steal_result").size(), "exactly one steal_result per window");
        assertNull(g.invariantError());
    }
}
