package heist.game;

import java.util.HashMap;
import java.util.Map;

/**
 * MG-45 Rival Heist: two players race the same seeded minigame sequence. Attempt k for either duelist uses
 * seed baseSeed + k, so both always face identical puzzles. First success by receive order wins.
 */
public final class RivalHeist {
    public final String a;
    public final String b;
    public final String gameId;
    public final long baseSeed;
    public final Map<String, Integer> attempts = new HashMap<>();
    public String winner;

    public RivalHeist(String a, String b, String gameId, long baseSeed) {
        this.a = a;
        this.b = b;
        this.gameId = gameId;
        this.baseSeed = baseSeed;
    }

    public boolean isDuelist(String id) {
        return a.equals(id) || b.equals(id);
    }

    public String opponent(String id) {
        return a.equals(id) ? b : a;
    }

    public long nextSeed(String id) {
        int k = attempts.merge(id, 1, Integer::sum) - 1;
        return baseSeed + k;
    }

    /** Returns true if this success wins the duel. */
    public boolean claim(String id) {
        if (winner != null || !isDuelist(id)) return false;
        winner = id;
        return true;
    }
}
