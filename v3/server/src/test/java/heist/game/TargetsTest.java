package heist.game;

import heist.util.Rng;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TargetsTest {
    @Test
    void alwaysADerangementForEveryGroupSize() {
        for (int n = 2; n <= 8; n++) {
            List<String> ids = new java.util.ArrayList<>();
            for (int i = 0; i < n; i++) ids.add("p" + i);
            for (long seed = 0; seed < 300; seed++) {
                Map<String, String> m = Targets.assign(new Rng(seed), ids, null);
                assertEquals(n, m.size());
                assertEquals(new HashSet<>(ids), new HashSet<>(m.values()), "a permutation: everyone is hunted exactly once");
                m.forEach((k, v) -> assertNotEquals(k, v, "never your own target"));
            }
        }
    }

    @Test
    void teamModeAvoidsTeammatesWhenPossible() {
        List<String> ids = List.of("a", "b", "c", "d", "e", "f");
        Map<String, String> teams = new HashMap<>(Map.of("a", "X", "b", "X", "c", "Y", "d", "Y", "e", "Z", "f", "Z"));
        for (long seed = 0; seed < 200; seed++) {
            Map<String, String> m = Targets.assign(new Rng(seed), ids, teams);
            m.forEach((k, v) -> assertNotEquals(teams.get(k), teams.get(v)));
        }
    }

    @Test
    void bountyGoesToHuntersWhoOutEarnTheirTarget() {
        Map<String, String> t = Map.of("a", "b", "b", "c", "c", "a");
        Map<String, Long> e = Map.of("a", 300L, "b", 100L, "c", 100L);
        List<String> w = Targets.bountyWinners(t, e);
        assertTrue(w.contains("a"));
        assertEquals(1, w.size(), "ties do not pay");
    }
}
