package heist.tools;

import heist.TestSupport;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** IF-04 as part of `mvn test`: full game, 6 bots, real sockets, under 3 minutes. */
class SmokeTest {
    @Test
    void fullGameWithSixBots() throws Exception {
        Smoke.Result r = Smoke.run(TestSupport.ROOT, 20, 6);
        assertTrue(r.passed(), String.join("\n", r.failures()) + "\n" + r.summary());
        assertTrue(r.elapsedMs() < 180_000);
    }
}
