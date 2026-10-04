package heist.game;

import heist.util.Rng;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * BE-08 secret targets. Every player gets a target that is never themselves (a derangement). In team
 * mode we also try to avoid teammates; if that is impossible we fall back to a plain derangement.
 */
public final class Targets {
    private Targets() {}

    public static Map<String, String> assign(Rng rng, List<String> ids, Map<String, String> teamOf) {
        if (ids.size() < 2) return Map.of();
        for (int attempt = 0; attempt < 200; attempt++) {
            Map<String, String> m = derangement(rng, ids);
            if (teamOf == null || teamOf.isEmpty() || avoidsTeammates(m, teamOf)) return m;
        }
        return derangement(rng, ids);
    }

    /** Sattolo's algorithm: a uniformly random single cycle, which is always a derangement. */
    public static Map<String, String> derangement(Rng rng, List<String> ids) {
        List<String> order = rng.shuffled(ids);
        Map<String, String> out = new HashMap<>();
        for (int i = 0; i < order.size(); i++) {
            out.put(order.get(i), order.get((i + 1) % order.size()));
        }
        return out;
    }

    static boolean avoidsTeammates(Map<String, String> m, Map<String, String> teamOf) {
        for (var e : m.entrySet()) {
            String a = teamOf.get(e.getKey());
            if (a != null && a.equals(teamOf.get(e.getValue()))) return false;
        }
        return true;
    }

    /** Hunters who out-earned their target this round. */
    public static List<String> bountyWinners(Map<String, String> targets, Map<String, Long> earnings) {
        List<String> out = new ArrayList<>();
        for (var e : targets.entrySet()) {
            long mine = earnings.getOrDefault(e.getKey(), 0L);
            long theirs = earnings.getOrDefault(e.getValue(), 0L);
            if (mine > theirs) out.add(e.getKey());
        }
        return out;
    }
}
