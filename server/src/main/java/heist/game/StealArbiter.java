package heist.game;

/**
 * BE-07: one Steal window. The first valid key_scan by server receive order wins; everything after
 * the winner (or after the window closes) is rejected. Client timestamps are never consulted.
 */
public final class StealArbiter {
    public enum Reject { NO_WINDOW, CLOSED, ALREADY_WON, OWN_KEY, UNKNOWN_KEY, KEY_ALREADY_STOLEN, NOT_PLAYING }

    public record Outcome(boolean won, Reject reject, String victimId) {
        static Outcome win(String victim) {
            return new Outcome(true, null, victim);
        }

        static Outcome no(Reject r) {
            return new Outcome(false, r, null);
        }
    }

    private final long opensAt;
    private final long closesAt;
    private String winner;

    public StealArbiter(long opensAt, long closesAt) {
        this.opensAt = opensAt;
        this.closesAt = closesAt;
    }

    public boolean isOpen(long now) {
        return winner == null && now >= opensAt && now < closesAt;
    }

    public long closesAt() {
        return closesAt;
    }

    public String winner() {
        return winner;
    }

    /**
     * Decide a scan. {@code victim} is the player who owns the scanned key (null if the key is unknown).
     * Called under the room lock, so receive order == call order.
     */
    public Outcome scan(PlayerState scanner, PlayerState victim, long now) {
        if (winner != null) return Outcome.no(Reject.ALREADY_WON);
        if (now < opensAt || now >= closesAt) return Outcome.no(Reject.CLOSED);
        if (victim == null) return Outcome.no(Reject.UNKNOWN_KEY);
        if (victim.id.equals(scanner.id)) return Outcome.no(Reject.OWN_KEY);
        if (victim.keyStolen) return Outcome.no(Reject.KEY_ALREADY_STOLEN);
        winner = scanner.id;
        return Outcome.win(victim.id);
    }
}
