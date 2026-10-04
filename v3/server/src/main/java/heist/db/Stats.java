package heist.db;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** DB-03 stats and replay timeline computed from the event list (works for both sinks). */
public final class Stats {
    private Stats() {}

    public static Map<String, Object> perPlayer(List<JsonNode> events) {
        Map<String, Map<String, Object>> out = new LinkedHashMap<>();
        Map<String, String> names = names(events);
        for (JsonNode e : events) {
            String pid = e.path("player").asText(null);
            if (pid == null || pid.isEmpty() || "null".equals(pid)) continue;
            Map<String, Object> s = out.computeIfAbsent(pid, k -> new LinkedHashMap<>(Json.obj("id", k, "name", names.getOrDefault(k, k),
                    "successes", 0L, "fails", 0L, "steals", 0L, "stolen", 0L, "robbed", 0L, "freezeViolations", 0L, "earned", 0L)));
            JsonNode p = e.path("payload");
            switch (e.path("type").asText()) {
                case "minigame_result" -> {
                    if (p.path("success").asBoolean()) {
                        inc(s, "successes", 1);
                        inc(s, "earned", p.path("delta").asLong());
                    } else inc(s, "fails", 1);
                }
                case "steal" -> {
                    inc(s, "steals", 1);
                    inc(s, "stolen", p.path("amount").asLong());
                    String victim = p.path("victim").asText();
                    Map<String, Object> v = out.get(victim);
                    if (v != null) inc(v, "robbed", 1);
                }
                case "freeze_violation" -> inc(s, "freezeViolations", 1);
                default -> { }
            }
        }
        return Json.obj("players", new ArrayList<>(out.values()));
    }

    /** Cash-over-time series plus steal/fail markers for the replay page. */
    public static Map<String, Object> timeline(List<JsonNode> events) {
        Map<String, String> names = names(events);
        List<Map<String, Object>> points = new ArrayList<>();
        List<Map<String, Object>> markers = new ArrayList<>();
        List<Map<String, Object>> bank = new ArrayList<>();
        for (JsonNode e : events) {
            String type = e.path("type").asText();
            String pid = e.path("player").asText(null);
            String ts = e.path("ts").asText();
            JsonNode p = e.path("payload");
            if (p.has("wallet") && pid != null && !"null".equals(pid)) {
                points.add(Json.obj("ts", ts, "player", pid, "wallet", p.path("wallet").asLong()));
            }
            if ("steal".equals(type) && p.has("victimWallet")) {
                points.add(Json.obj("ts", ts, "player", p.path("victim").asText(), "wallet", p.path("victimWallet").asLong()));
            }
            if (p.has("bank")) bank.add(Json.obj("ts", ts, "bank", p.path("bank").asLong()));
            if ("steal".equals(type) || ("minigame_result".equals(type) && !p.path("success").asBoolean())
                    || "freeze_violation".equals(type) || "escape".equals(type) || "round_start".equals(type)) {
                markers.add(Json.obj("ts", ts, "type", type, "player", pid, "round", e.path("round").asInt(),
                        "label", label(type, p, names.getOrDefault(pid, pid), names)));
            }
        }
        return Json.obj("names", names, "points", points, "bank", bank, "markers", markers);
    }

    private static String label(String type, JsonNode p, String who, Map<String, String> names) {
        return switch (type) {
            case "steal" -> who + " robbed " + names.getOrDefault(p.path("victim").asText(), "?") + " ($" + p.path("amount").asLong() + ")";
            case "minigame_result" -> who + " bombed " + p.path("game").asText();
            case "freeze_violation" -> who + " moved during FREEZE";
            case "escape" -> who + " escaped with $" + p.path("banked").asLong();
            case "round_start" -> "Round start (" + p.path("type").asText() + ")";
            default -> type;
        };
    }

    public static Map<String, String> names(List<JsonNode> events) {
        Map<String, String> names = new LinkedHashMap<>();
        for (JsonNode e : events) {
            if ("join".equals(e.path("type").asText())) names.put(e.path("player").asText(), e.path("payload").path("name").asText());
        }
        return names;
    }

    /** Leaderboard across finished rooms. */
    public static List<Map<String, Object>> leaderboard(EventStore store, int rooms) throws Exception {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String room : store.finishedRooms(rooms)) {
            for (JsonNode e : store.events(room)) {
                if (!"game_end".equals(e.path("type").asText())) continue;
                for (JsonNode s : e.path("payload").path("standings")) {
                    rows.add(Json.obj("room", room, "name", s.path("name").asText(), "stash", s.path("stash").asLong(),
                            "rank", s.path("rank").asInt(), "ts", e.path("ts").asText()));
                }
            }
        }
        rows.sort((a, b) -> Long.compare((Long) b.get("stash"), (Long) a.get("stash")));
        return rows.subList(0, Math.min(20, rows.size()));
    }

    private static void inc(Map<String, Object> m, String k, long by) {
        m.put(k, ((Long) m.get(k)) + by);
    }
}
