package heist.game;

import heist.config.Balance;
import heist.util.Rng;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * TM-01 optional team mode: random crews, a role swap between rounds, and a shared payout split where
 * each crew's positive round earnings are pooled and shared equally.
 */
public final class Teams {
    private Teams() {}

    public static Map<String, String> form(Balance b, Rng rng, List<String> ids, Content content) {
        int size = Math.max(2, b.i("teams.size"));
        List<String> order = rng.shuffled(ids);
        Map<String, String> teamOf = new LinkedHashMap<>();
        int teams = Math.max(1, order.size() / size);
        for (int i = 0; i < order.size(); i++) {
            teamOf.put(order.get(i), content.teamName(Math.min(i / size, teams - 1)));
        }
        return teamOf;
    }

    /** Maybe swap one member between two crews. Returns the swapped pair or null. */
    public static String[] maybeSwap(Balance b, Rng rng, Map<String, String> teamOf) {
        if (teamOf.size() < 4 || !rng.chance(b.d("teams.swapChance"))) return null;
        List<String> ids = new ArrayList<>(teamOf.keySet());
        for (int tries = 0; tries < 20; tries++) {
            String a = rng.pick(ids), c = rng.pick(ids);
            if (!teamOf.get(a).equals(teamOf.get(c))) {
                String ta = teamOf.get(a);
                teamOf.put(a, teamOf.get(c));
                teamOf.put(c, ta);
                return new String[]{a, c};
            }
        }
        return null;
    }

    /** Wallet adjustments (sum to zero) that split each crew's positive earnings equally. */
    public static Map<String, Long> split(Map<String, String> teamOf, Map<String, Long> earnings) {
        Map<String, List<String>> members = new LinkedHashMap<>();
        teamOf.forEach((id, t) -> members.computeIfAbsent(t, k -> new ArrayList<>()).add(id));
        Map<String, Long> delta = new HashMap<>();
        for (List<String> crew : members.values()) {
            long pool = 0;
            for (String id : crew) pool += Math.max(0, earnings.getOrDefault(id, 0L));
            long share = pool / crew.size();
            long rem = pool - share * crew.size();
            for (int i = 0; i < crew.size(); i++) {
                String id = crew.get(i);
                delta.put(id, share + (i == 0 ? rem : 0) - Math.max(0, earnings.getOrDefault(id, 0L)));
            }
        }
        return delta;
    }
}
