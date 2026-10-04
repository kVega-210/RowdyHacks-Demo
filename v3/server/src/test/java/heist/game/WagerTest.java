package heist.game;

import heist.TestSupport;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WagerTest {
    @Test
    void tiersComeFromBalanceAndScaleBothWays() {
        Wager.Tier t3 = Wager.tier(TestSupport.BALANCE, "3");
        assertEquals(TestSupport.BALANCE.d("wager.tiers.3.payoutMult"), t3.payoutMult());
        assertEquals(Math.round(200 * t3.payoutMult()), Wager.resolve(200, 50, t3, true));
        assertEquals(-Math.round(50 * t3.failPenaltyMult()), Wager.resolve(200, 50, t3, false));
        assertTrue(Wager.resolve(200, 50, Wager.tier(TestSupport.BALANCE, "3"), true) > Wager.resolve(200, 50, Wager.tier(TestSupport.BALANCE, "1"), true));
    }

    @Test
    void unknownTierFallsBackToNeutral() {
        assertSame(Wager.NONE, Wager.tier(TestSupport.BALANCE, "99"));
        assertSame(Wager.NONE, Wager.tier(TestSupport.BALANCE, null));
        assertEquals(100, Wager.resolve(100, 50, Wager.NONE, true));
    }
}
