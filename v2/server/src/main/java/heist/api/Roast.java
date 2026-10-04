package heist.api;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.util.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * AI-02 post-game roast. Sends the DB-04 facts to Gemini for 4-6 lines per player plus awards, with a
 * hard timeout and a template fallback so the final screen always has something to show.
 */
public final class Roast {
    private final Gemini gemini;
    private final Balance b;

    public Roast(Gemini gemini, Balance b) {
        this.gemini = gemini;
        this.b = b;
    }

    public Map<String, Object> roast(Map<String, Object> facts) {
        if (gemini.enabled()) {
            try {
                JsonNode out = gemini.generateJson(prompt(facts), b.l("ai.geminiTimeoutMs"));
                Map<String, Object> valid = validate(out, facts);
                if (valid != null) return valid;
            } catch (Exception e) {
                System.err.println("[roast] gemini fallback: " + e.getMessage());
            }
        }
        return template(facts);
    }

    String prompt(Map<String, Object> facts) {
        return """
                You are "The Mastermind", the smug narrator of HEIST HAVOC!, a party game where friends play minigames on \
                their phones, sabotage each other and drain the bank until it is empty. Roast each player in a playful, \
                PG-13, never cruel way based ONLY on these facts. No profanity, no slurs, nothing about appearance, \
                identity or real-life traits. Each line under 110 characters.
                Return JSON exactly like: {"players":[{"name":"...","lines":["...","...","...","..."]}],\
                "awards":{"biggestThief":"name","chicken":"name","closestCall":"name"}}
                Give each player between %d and %d lines. Facts: %s
                """.formatted(b.i("ai.roastLinesMin"), b.i("ai.roastLinesMax"), Json.write(facts));
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> validate(JsonNode out, Map<String, Object> facts) {
        if (out == null || !out.path("players").isArray()) return null;
        List<Map<String, Object>> players = new ArrayList<>();
        for (JsonNode p : out.path("players")) {
            String name = p.path("name").asText("");
            List<String> lines = new ArrayList<>();
            for (JsonNode l : p.path("lines")) {
                String s = l.asText("").trim();
                if (!s.isEmpty() && s.length() <= 160 && Dares.safe(s)) lines.add(s);
            }
            if (name.isEmpty() || lines.size() < b.i("ai.roastLinesMin")) return null;
            players.add(Json.obj("name", name, "lines", lines.subList(0, Math.min(lines.size(), b.i("ai.roastLinesMax")))));
        }
        if (players.isEmpty()) return null;
        Map<String, Object> awards = (Map<String, Object>) facts.get("awards");
        JsonNode a = out.path("awards");
        return Json.obj("source", "gemini", "players", players, "awards", Json.obj(
                "biggestThief", a.path("biggestThief").asText((String) awards.get("biggestThief")),
                "chicken", a.path("chicken").asText((String) awards.get("chicken")),
                "closestCall", a.path("closestCall").asText((String) awards.get("closestCall"))));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> template(Map<String, Object> facts) {
        List<Map<String, Object>> players = new ArrayList<>();
        for (Map<String, Object> f : (List<Map<String, Object>>) facts.get("players")) {
            String n = (String) f.get("name");
            long wins = (Long) f.get("wins"), fails = (Long) f.get("fails");
            long frozen = (Long) f.get("freezeViolations"), streak = (Long) f.get("bestStreak");
            List<String> lines = new ArrayList<>();
            lines.add(n + " cracked " + wins + " locks and fumbled " + fails + ". The vault sends its regards.");
            // v2: no stealing, so the roast leans on freezes and streaks instead.
            lines.add(frozen > 0 ? n + " twitched during " + frozen + " freeze" + (frozen == 1 ? "" : "s") + ". The cameras loved it."
                    : n + " froze like a statue every time. Suspiciously good at standing still.");
            lines.add(streak >= 3 ? n + " hit a " + streak + "-job streak. Somebody call the insurance company."
                    : n + " never strung three jobs together. Consistency is a myth.");
            if (f.get("worstGame") != null) lines.add(n + "'s nemesis: " + f.get("worstGame") + ". It wins. Every time.");
            lines.add(n + " made it out. The getaway car was mostly paperwork.");
            while (lines.size() < b.i("ai.roastLinesMin")) lines.add("The Mastermind has reviewed " + n + "'s performance. No further questions.");
            players.add(Json.obj("name", n, "lines", lines.subList(0, Math.min(lines.size(), b.i("ai.roastLinesMax")))));
        }
        return Json.obj("source", "template", "players", players, "awards", facts.get("awards"));
    }
}
