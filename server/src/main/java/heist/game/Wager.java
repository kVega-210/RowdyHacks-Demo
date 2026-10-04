package heist.game;

import heist.config.Balance;

/**
 * BE-12 generic wager. A tier scales the base payout on success and the base penalty on failure.
 * Used by the choice minigames (MG-08/14/40), the wager wrappers (MG-35/36/37) and double-or-nothing cards.
 */
public final class Wager {
    private Wager() {}

    public record Tier(String id, double payoutMult, double failPenaltyMult) {
    }

    public static final Tier NONE = new Tier("0", 1.0, 1.0);

    public static Tier tier(Balance b, String id) {
        if (id == null || !b.has("wager.tiers." + id)) return NONE;
        return new Tier(id, b.d("wager.tiers." + id + ".payoutMult"), b.d("wager.tiers." + id + ".failPenaltyMult"));
    }

    public static boolean validWrapperTier(Balance b, String wrapper, String tier) {
        return wrapper != null && tier != null && b.has("wager.wrappers." + wrapper + "." + tier);
    }

    /** Signed wallet delta before bank/wallet caps are applied. */
    public static long resolve(long basePayout, long basePenalty, Tier t, boolean success) {
        return success ? Math.round(basePayout * t.payoutMult()) : -Math.round(basePenalty * t.failPenaltyMult());
    }
}
