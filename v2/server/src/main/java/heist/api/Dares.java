package heist.api;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.game.Content;
import heist.util.Json;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * AI-01 dare/card variants. Asks Gemini for schema-shaped dares, runs a safety filter, caches the result,
 * and falls back to the dare/workout cards in cards.json when the call fails or is slow.
 */
public final class Dares {
    private static final Pattern UNSAFE = Pattern.compile(
            "(?i)\\b(alcohol|beer|shot|drink|drunk|vodka|kiss|lick|strip|naked|undress|slap|punch|hit|kick|bite|"
                    + "throw|fire|knife|blood|drug|weed|smoke|vape|sex|touch (someone|a stranger)|stranger|run outside|"
                    + "climb|jump off|hold your breath|eat|swallow|phone number|password|money|venmo|cash app|steal from)\\b");
    private static final long CACHE_MS = 10 * 60 * 1000L;

    private final Gemini gemini;
    private final Balance b;
    private final Content content;
    private List<Map<String, Object>> cache = List.of();
    private long cachedAt;

    public Dares(Gemini gemini, Balance b, Content content) {
        this.gemini = gemini;
        this.b = b;
        this.content = content;
    }

    /** True if a line passes the safety filter. Shared with the roast validator. */
    public static boolean safe(String s) {
        return s != null && !UNSAFE.matcher(s).find();
    }

    public synchronized Map<String, Object> get(int count) {
        long now = System.currentTimeMillis();
        if (cache.size() >= count && now - cachedAt < CACHE_MS) return Json.obj("source", "gemini-cache", "dares", cache.subList(0, count));
        if (gemini.enabled()) {
            try {
                JsonNode out = gemini.generateJson(prompt(Math.max(count, 6)), b.l("ai.daresTimeoutMs"));
                List<Map<String, Object>> dares = validate(out);
                if (dares.size() >= count) {
                    cache = dares;
                    cachedAt = now;
                    return Json.obj("source", "gemini", "dares", dares.subList(0, count));
                }
            } catch (Exception e) {
                System.err.println("[dares] fallback: " + e.getMessage());
            }
        }
        return Json.obj("source", "cards", "dares", fallback(count));
    }

    String prompt(int n) {
        return """
                Write %d short party dares for HEIST HAVOC!, a heist-themed phone party game played at a table. \
                Dares must be safe for a hackathon venue: no food or drink, no touching other people, no leaving the table, \
                nothing involving money, phones of others, personal info, or anything risky. Funny, heist flavored, \
                doable in under 20 seconds while seated or standing next to the table.
                Return JSON: {"dares":[{"title":"max 24 chars","text":"max 140 chars","physical":true|false}]}
                """.formatted(n);
    }

    static List<Map<String, Object>> validate(JsonNode out) {
        List<Map<String, Object>> dares = new ArrayList<>();
        if (out == null) return dares;
        for (JsonNode d : out.path("dares")) {
            String title = d.path("title").asText("").trim();
            String text = d.path("text").asText("").trim();
            if (title.isEmpty() || title.length() > 32 || text.length() < 10 || text.length() > 160) continue;
            if (!safe(title) || !safe(text)) continue;
            dares.add(Json.obj("title", title, "text", text, "physical", d.path("physical").asBoolean(false), "effect", "dare"));
        }
        return dares;
    }

    List<Map<String, Object>> fallback(int count) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Content.Card c : content.cards.values()) {
            if (("dare".equals(c.effect()) || "workout".equals(c.effect())) && out.size() < count) {
                out.add(Json.obj("title", c.title(), "text", c.text(), "physical", c.physical(), "effect", c.effect(), "card", c.number()));
            }
        }
        return out;
    }
}
