package heist.game;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;

/**
 * BE-09 final standings. Winner = highest stash (v2: every wallet is banked automatically at the end).
 * Tie-break, in order: fewer fails, more successes, then join order. Join order is unique, so there is
 * always exactly one winner.
 */
public final class Endgame {
    private Endgame() {}

    public static final Comparator<PlayerState> RANKING = Comparator
            .comparingLong((PlayerState p) -> -p.stash)
            .thenComparingInt(p -> p.fails)
            .thenComparingInt(p -> -p.successes)
            .thenComparingInt(p -> p.joinOrder);

    public static List<PlayerState> standings(Collection<PlayerState> players) {
        List<PlayerState> out = new ArrayList<>(players);
        out.sort(RANKING);
        return out;
    }
}
