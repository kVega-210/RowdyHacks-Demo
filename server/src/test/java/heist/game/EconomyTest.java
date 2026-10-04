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
    void penaltyNeverTakesTheWalletNegativeAndIsBurned() {
        Economy.Ledger l = new Economy.Ledger(1000);
        PlayerState a = p();
        Economy.payout(l, a, 30);
        assertEquals(30, Economy.penalty(l, a, 50));
        assertEquals(0, a.wallet);
        assertEquals(30, l.burned);
        assertEquals(970, l.bank, "penalties are burned, never returned to the bank");
    }

    @Test
    void stealTransfersWalletCashOnly() {
        PlayerState v = p(), t = new PlayerState("p2", "B", 2, false);
        v.wallet = 400;
        v.stash = 1000;
        long amt = Economy.stealAmount(v.wallet, 0.25, 100, 0);
        assertEquals(100, amt);
        assertEquals(100, Economy.transfer(v, t, amt));
        assertEquals(300, v.wallet);
        assertEquals(1000, v.stash, "stash is safe");
        assertEquals(100, t.wallet);
        assertEquals(30, Economy.stealAmount(30, 0.25, 100, 0), "never more than the victim has");
        assertEquals(400, Economy.stealAmount(1000, 0.25, 100, 0.15));
    }

    @Test
    void escapeBanksAndEndLosesWallet() {
        Economy.Ledger l = new Economy.Ledger(1000);
        PlayerState a = p(), c = new PlayerState("p2", "B", 2, false);
        Economy.payout(l, a, 200);
        Economy.payout(l, c, 300);
        assertEquals(200, Economy.bankWallet(a));
        assertEquals(200, a.stash);
        assertEquals(0, a.wallet);
        assertEquals(300, Economy.loseWallet(l, c));
        assertEquals(0, c.wallet);
        assertEquals(1000, l.bank + l.burned + a.wallet + a.stash + c.wallet + c.stash);
    }

    @Test
    void successAmountScales() {
        assertEquals(300, Economy.successAmount(200, 1.5, 1.0, 1.0));
        assertEquals(700, Economy.successAmount(200, 1.0, 1.0, 3.5));
        assertEquals(50, Economy.successAmount(100, 1.0, 0.5, 1.0));
    }
}
