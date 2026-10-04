package heist.game;

import heist.TestSupport;
import heist.config.Balance;
import heist.util.Rng;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EventSchedulerTest {
    private final Balance b = TestSupport.BALANCE;

    @Test
    void windowsRespectEdgesAndGaps() {
        long play = b.l("rounds.playMs");
        for (long seed = 0; seed < 500; seed++) {
            List<EventScheduler.Scheduled> plan = EventScheduler.plan(b, new Rng(seed), true, play);
            for (int i = 0; i < plan.size(); i++) {
                EventScheduler.Scheduled e = plan.get(i);
                assertTrue(e.atMs() >= b.l("events.noneInFirstMs"), "none in the opening seconds");
                assertTrue(e.endMs() <= play - b.l("events.noneInLastMs"), "none in the last 3s");
                if (i > 0) assertTrue(e.atMs() - plan.get(i - 1).endMs() >= b.l("events.minGapMs"), "min gap");
            }
        }
    }

    @Test
    void noStealsInHackRounds() {
        for (long seed = 0; seed < 200; seed++) {
            for (var e : EventScheduler.plan(b, new Rng(seed), false, b.l("rounds.playMs"))) {
                assertFalse(e.kind() == EventScheduler.Kind.STEAL);
            }
        }
    }

    @Test
    void sameSeedSamePlan() {
        assertEquals(EventScheduler.plan(b, new Rng(42), true, 50000), EventScheduler.plan(b, new Rng(42), true, 50000));
    }

    @Test
    void tinyRoundsDropEventsInsteadOfBreakingRules() {
        assertTrue(EventScheduler.plan(b, new Rng(1), true, 6000).isEmpty());
    }
}
