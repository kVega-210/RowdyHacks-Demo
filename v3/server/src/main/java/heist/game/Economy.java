package heist.game;

/**
 * BE-05 money rules as pure functions over a Ledger. v2: payouts come out of the bank and penalties go back
 * into it; the game ends when the bank is empty. Round payouts are scaled so the bank drains over the
 * host's chosen number of rounds (see {@link #roundScale}).
 * Invariant: bankStart == bank + sum(wallets) + sum(stashes) + burned (burned = cash of kicked players).
 */
public final class Economy {
    private Economy() {}

    /** Mutable totals for one game. */
    public static final class Ledger {
        public long bankStart;
        public long bank;
        public long burned;

        public Ledger(long bankStart) {
            this.bankStart = bankStart;
            this.bank = bankStart;
        }

        public boolean bankEmpty() {
            return bank <= 0;
        }
    }

    /** Pay {@code amount} from the bank into the wallet, capped at what the bank holds. Returns the amount paid. */
    public static long payout(Ledger l, PlayerState p, long amount) {
        long paid = Math.max(0, Math.min(amount, l.bank));
        l.bank -= paid;
        p.credit(paid);
        return paid;
    }

    /** Take a penalty from the wallet (never below zero) and return it to the bank. Returns the amount taken. */
    public static long penalty(Ledger l, PlayerState p, long amount) {
        long taken = p.debit(amount);
        l.bank += taken;
        return taken;
    }

    /** End of game: the wallet is banked into the stash automatically. */
    public static long bankWallet(PlayerState p) {
        long w = p.wallet;
        p.stash += w;
        p.wallet = 0;
        return w;
    }

    /** v3: the starting vault for a crew of {@code players}: perPlayer x players^exponent (bigger crews, bigger vault). */
    public static long startingBank(long perPlayer, int players, double exponent) {
        return Math.round(perPlayer * Math.pow(Math.max(1, players), exponent));
    }

    /** Success payout before the bank cap: base by difficulty x round-type multiplier x score x wager. */
    public static long successAmount(long base, double roundMult, double scoreMult, double wagerMult) {
        return Math.round(base * roundMult * scoreMult * wagerMult);
    }

    /**
     * v2 payout scale for one round: this round's share of the bank (bank / rounds left, the whole bank in
     * overtime) divided by what the crew would earn unscaled. Overtime rounds pay out harder each time so
     * the bank always empties. Clamped to [scaleMin, scaleMax], except in overtime where the max is lifted.
     */
    public static double roundScale(long bank, int roundsLeft, int overtime, int players, long basePayout, double roundMult,
                                    double expectedPaidJobs, double scaleMin, double scaleMax, double overtimeBoost) {
        double expected = Math.max(1, players) * expectedPaidJobs * basePayout * roundMult;
        if (expected <= 0) return 1.0;
        double share = (double) bank / Math.max(1, roundsLeft);
        double s = share / expected;
        if (overtime > 0) return Math.round(Math.max(scaleMin, s * (1 + overtimeBoost * overtime)) * 100) / 100.0;
        return Math.round(Math.max(scaleMin, Math.min(scaleMax, s)) * 100) / 100.0;
    }
}
