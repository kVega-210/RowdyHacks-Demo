package heist.game;

import heist.config.Balance;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * PH-04 card flow: a player enters a card number, the other phones vote pass/fail for voteMs, the
 * majority applies the card's cash effect (ties and no votes count as a pass). Effects are keyed to
 * balance.json "cards.<effect>".
 */
public final class Cards {
    private Cards() {}

    public static final class Vote {
        public final String id;
        public final Content.Card card;
        public final String playerId;
        public final long endsAt;
        public final Map<String, Boolean> ballots = new LinkedHashMap<>();

        public Vote(String id, Content.Card card, String playerId, long endsAt) {
            this.id = id;
            this.card = card;
            this.playerId = playerId;
            this.endsAt = endsAt;
        }

        public boolean passed() {
            long yes = ballots.values().stream().filter(v -> v).count();
            long no = ballots.size() - yes;
            return yes >= no;
        }
    }

    public record Effect(long delta, String note) {
    }

    /** Apply a resolved card to its player. Returns the wallet delta actually applied. */
    public static Effect apply(Balance b, Economy.Ledger l, PlayerState p, Content.Card card, boolean passed, boolean optOut) {
        if (optOut) {
            long pen = card.physical() ? 0 : b.l("cards.optOutPenalty");
            return new Effect(-Economy.penalty(l, p, pen), pen == 0 ? "opted out (physical limit, no penalty)" : "opted out");
        }
        String key = "cards." + card.effect();
        switch (card.effect()) {
            case "dare", "workout" -> {
                if (passed) return new Effect(Economy.payout(l, p, b.l(key + ".success")), "crew approved");
                return new Effect(-Economy.penalty(l, p, Math.abs(b.l(key + ".fail"))), "crew rejected");
            }
            case "doubleOrNothing" -> {
                long base = b.l(key + ".base");
                long d = Wager.resolve(base, base, Wager.tier(b, b.s(key + ".tier")), passed);
                return d >= 0 ? new Effect(Economy.payout(l, p, d), "doubled up") : new Effect(-Economy.penalty(l, p, -d), "nothing");
            }
            case "shield" -> {
                if (passed) {
                    p.shield = true;
                    return new Effect(0, "shield up: blocks the next steal");
                }
                return new Effect(-Economy.penalty(l, p, Math.abs(b.l(key + ".fail"))), "no shield");
            }
            case "stealBoost" -> {
                if (passed) {
                    p.stealBoost += b.d(key + ".extraPct");
                    return new Effect(0, "next steal takes more");
                }
                return new Effect(-Economy.penalty(l, p, Math.abs(b.l(key + ".fail"))), "no boost");
            }
            default -> {
                return new Effect(0, "no effect");
            }
        }
    }
}
