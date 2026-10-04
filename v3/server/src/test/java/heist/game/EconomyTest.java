package heist.game;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EconomyTest {
    private static PlayerState p() {
        return new PlayerState("p1", "A", 1, false);
    }

    @Test
    void payoutIsCappedByTheBank() {
        Economy.Ledger l = new Economy.Ledger(150);
        PlayerState a = p();
        assertEquals(100, Economy.payout(l, a, 100));
        assertEquals(50, Economy.payout(l, a, 100));
        assertEquals(0, l.bank);
        assertTrue(l.bankEmpty());
        assertEquals(150, a.wallet);
        assertEquals(0, Economy.payout(l, a, 100));
    }

    @Test
    void penaltyNeverTakesTheWalletNegativeAndGoesBackToTheBank() {
        Economy.Ledger l = new Economy.Ledger(1000);
        PlayerState a = p();
        Economy.payout(l, a, 30);
        assertEquals(30, Economy.penalty(l, a, 50));
        assertEquals(0, a.wallet);
        assertEquals(0, l.burned);
        assertEquals(1000, l.bank, "v2: penalties go back into the bank");
    }

    @Test
    void endOfGameBanksEveryWallet() {
        Economy.Ledger l = new Economy.Ledger(1000);
        PlayerState a = p(), c = new PlayerState("p2", "B", 2, false);
        Economy.payout(l, a, 200);
        Economy.payout(l, c, 300);
        assertEquals(200, Economy.bankWallet(a));
        assertEquals(200, a.stash);
        assertEquals(0, a.wallet);
        assertEquals(300, Economy.bankWallet(c));
        assertEquals(0, c.wallet);
        assertEquals(1000, l.bank + l.burned + a.wallet + a.stash + c.wallet + c.stash);
    }

    @Test
    void roundScaleSpreadsTheBankOverTheRoundsLeft() {
        // 4 players x 3 paid jobs x $100 = $1200 unscaled per round.
        assertEquals(2.0, Economy.roundScale(14400, 6, 0, 4, 100, 1.0, 3, 0.5, 8, 0.75));
        assertEquals(0.5, Economy.roundScale(100, 6, 0, 4, 100, 1.0, 3, 0.5, 8, 0.75), "never below the floor");
        assertEquals(8.0, Economy.roundScale(10_000_000, 1, 0, 4, 100, 1.0, 3, 0.5, 8, 0.75), "capped in regular rounds");
        assertTrue(Economy.roundScale(12000, 1, 2, 4, 100, 1.0, 3, 0.5, 8, 0.75) > 10, "overtime lifts the cap and pays harder");
    }

    @Test
    void biggerCrewsGetABiggerVaultAndMoreCashPerJob() {
        long two = Economy.startingBank(4000, 2, 1.1), thirty = Economy.startingBank(4000, 30, 1.1);
        assertTrue(thirty > 15 * two, "the vault grows faster than the crew");
        // Per-job pay in round 1 = this round's share of the vault spread over the crew's expected jobs.
        double perJob2 = Economy.roundScale(two, 6, 0, 2, 100, 1.0, 3, 0.5, 8, 0.75);
        double perJob30 = Economy.roundScale(thirty, 6, 0, 30, 100, 1.0, 3, 0.5, 8, 0.75);
        assertTrue(perJob30 > perJob2 * 1.25, "each completed job pays more in a big crew: " + perJob2 + " vs " + perJob30);
        assertEquals(8000, Economy.startingBank(4000, 2, 1.0), "exponent 1 = the old flat per-player vault");
    }

    @Test
    void successAmountScales() {
        assertEquals(300, Economy.successAmount(200, 1.5, 1.0, 1.0));
        assertEquals(700, Economy.successAmount(200, 1.0, 1.0, 3.5));
        assertEquals(50, Economy.successAmount(100, 1.0, 0.5, 1.0));
    }
}
