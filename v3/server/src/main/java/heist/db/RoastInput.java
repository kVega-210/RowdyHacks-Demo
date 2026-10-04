package heist.db;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DB-04: squeeze a game's event log into compact facts for Gemini: steals made/suffered, fails, streaks,
 * closest calls and the final standings. Kept small (well under 2KB for 8 players).
 */
public final class RoastInput {
    private RoastInput() {}

    public static Map<String, Object> build(List<JsonNode> events) {
        Map<String, String> names = Stats.names(events);
        Map<String, Map<String, Object>> facts = new LinkedHashMap<>();
        Map<String, Long> streak = new LinkedHashMap<>();
        for (var e : names.entrySet()) {
            facts.put(e.getKey(), new LinkedHashMap<>(Json.obj("name", e.getValue(), "wins", 0L, "fails", 0L, "stealsMade", 0L,
                    "cashStolen", 0L, "timesRobbed", 0L, "cashLostToThieves", 0L, "freezeViolations", 0L, "bestStreak", 0L,
                    "escaped", false, "lostAtEnd", 0L, "worstGame", null)));
        }
        Map<String, Map<String, Long>> failsByGame = new LinkedHashMap<>();
        List<Map<String, Object>> standings = new ArrayList<>();
        for (JsonNode e : events) {
            String pid = e.path("player").asText();
            Map<String, Object> f = facts.get(pid);
            JsonNode p = e.path("payload");
            switch (e.path("type").asText()) {
                case "minigame_result" -> {
                    if (f == null) break;
                    if (p.path("success").asBoolean()) {
                        add(f, "wins", 1);
                        long s = streak.merge(pid, 1L, Long::sum);
                        if (s > (Long) f.get("bestStreak")) f.put("bestStreak", s);
                    } else {
                        add(f, "fails", 1);
                        streak.put(pid, 0L);
                        failsByGame.computeIfAbsent(pid, k -> new LinkedHashMap<>()).merge(p.path("game").asText(), 1L, Long::sum);
                    }
                }
                case "steal" -> {
                    if (f != null) {
                        add(f, "stealsMade", 1);
                        add(f, "cashStolen", p.path("amount").asLong());
                    }
                    Map<String, Object> v = facts.get(p.path("victim").asText());
                    if (v != null) {
                        add(v, "timesRobbed", 1);
                        add(v, "cashLostToThieves", p.path("amount").asLong());
                    }
                }
                case "freeze_violation" -> {
                    if (f != null) add(f, "freezeViolations", 1);
                }
                case "escape", "auto_bank" -> {
                    if (f != null) f.put("escaped", true);
                }
                case "wallet_lost" -> {
                    if (f != null) f.put("lostAtEnd", p.path("amount").asLong());
                }
                case "game_end" -> p.path("standings").forEach(s -> standings.add(Json.obj("rank", s.path("rank").asInt(),
                        "name", s.path("name").asText(), "stash", s.path("stash").asLong())));
                default -> { }
            }
        }
        failsByGame.forEach((pid, m) -> m.entrySet().stream().max(Map.Entry.comparingByValue())
                .ifPresent(w -> facts.get(pid).put("worstGame", w.getKey())));
        return Json.obj("players", new ArrayList<>(facts.values()), "standings", standings, "awards", awards(facts));
    }

    /** Deterministic awards so the fallback roast and the Gemini prompt agree. */
    public static Map<String, Object> awards(Map<String, Map<String, Object>> facts) {
        // v2 (no stealing, no lost wallets): the biggest thief cracked the most jobs, the closest call broke the most freezes.
        String thief = maxBy(facts, "wins");
        String closest = maxBy(facts, "freezeViolations");
        // Chicken: escaped having won the fewest minigames.
        String chicken = null;
        long fewest = Long.MAX_VALUE;
        for (var f : facts.values()) {
            if ((Boolean) f.get("escaped") && (Long) f.get("wins") < fewest) {
                fewest = (Long) f.get("wins");
                chicken = (String) f.get("name");
            }
        }
        return Json.obj("biggestThief", thief, "chicken", chicken, "closestCall", closest);
    }

    private static String maxBy(Map<String, Map<String, Object>> facts, String key) {
        String best = null;
        long max = 0;
        for (var f : facts.values()) {
            long v = (Long) f.get(key);
            if (v > max) {
                max = v;
                best = (String) f.get("name");
            }
        }
        return best;
    }

    private static void add(Map<String, Object> m, String k, long by) {
        m.put(k, ((Long) m.get(k)) + by);
    }
}
