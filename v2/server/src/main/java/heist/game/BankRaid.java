package heist.game;

import java.util.ArrayList;
import java.util.List;

/** BE-13: for windowMs every phone shows GRAB; the first N tappers by receive order share the bonus. */
public final class BankRaid {
    public final long endsAt;
    public final int maxWinners;
    public final List<String> grabbers = new ArrayList<>();

    public BankRaid(long endsAt, int maxWinners) {
        this.endsAt = endsAt;
        this.maxWinners = maxWinners;
    }

    /** Returns the 1-based grab position, or -1 if the grab does not count. */
    public int grab(String playerId, long now) {
        if (now >= endsAt || grabbers.size() >= maxWinners || grabbers.contains(playerId)) return -1;
        grabbers.add(playerId);
        return grabbers.size();
    }

    public boolean full() {
        return grabbers.size() >= maxWinners;
    }

    public static long share(long bonusTotal, int winners) {
        return winners <= 0 ? 0 : bonusTotal / winners;
    }
}
