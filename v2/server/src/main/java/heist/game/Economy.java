package heist.game;

/**
 * BE-05 money rules as pure functions over a Ledger. The bank only ever shrinks: payouts come out of it
 * and penalties are burned (not returned), so the game always trends to an end.
 * Invariant: bankStart == bank + sum(wallets) + sum(stashes) + burned.
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

    /** Take a penalty from the wallet (never below zero) and burn it. Returns the amount taken. */
    public static long penalty(Ledger l, PlayerState p, long amount) {
        long taken = p.debit(amount);
        l.burned += taken;
        return taken;
    }

    /** Move wallet cash from one player to another (steals). Returns the amount moved. */
    public static long transfer(PlayerState from, PlayerState to, long amount) {
        long moved = from.debit(amount);
        to.credit(moved);
        return moved;
    }

    /** Escape: wallet moves to the safe stash. */
    public static long bankWallet(PlayerState p) {
        long w = p.wallet;
        p.stash += w;
        p.wallet = 0;
        return w;
    }

    /** End of game: unbanked wallet is lost. */
    public static long loseWallet(Ledger l, PlayerState p) {
        long w = p.wallet;
        p.wallet = 0;
        p.lostAtEnd = w;
        l.burned += w;
        return w;
    }

    /** Success payout before the bank cap: base by difficulty x round-type multiplier x score x wager. */
    public static long successAmount(long base, double roundMult, double scoreMult, double wagerMult) {
        return Math.round(base * roundMult * scoreMult * wagerMult);
    }

    public static long stealAmount(long victimWallet, double pct, long min, double boost) {
        long want = Math.max(min, Math.round(victimWallet * (pct + boost)));
        return Math.min(want, victimWallet);
    }
}
