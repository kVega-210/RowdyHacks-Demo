package heist.api;

import heist.TestSupport;
import heist.db.RoastInput;
import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** AI-01/AI-02/AU-04 fallbacks work with no API keys at all. */
class AiFallbackTest {
    private final Gemini off = new Gemini(null, null);

    @Test
    @SuppressWarnings("unchecked")
    void roastFallsBackToTemplatesWithFourToSixLines() {
        var events = List.of(
                Json.MAPPER.valueToTree(Json.obj("type", "join", "player", "p1", "payload", Json.obj("name", "Ace"))),
                Json.MAPPER.valueToTree(Json.obj("type", "join", "player", "p2", "payload", Json.obj("name", "Bea"))),
                Json.MAPPER.valueToTree(Json.obj("type", "minigame_result", "player", "p1", "payload", Json.obj("success", true, "game", "safecracker"))),
                Json.MAPPER.valueToTree(Json.obj("type", "minigame_result", "player", "p2", "payload", Json.obj("success", false, "game", "lockpick"))),
                Json.MAPPER.valueToTree(Json.obj("type", "auto_bank", "player", "p1", "payload", Json.obj("banked", 500))));
        Map<String, Object> facts = RoastInput.build(events.stream().map(n -> (com.fasterxml.jackson.databind.JsonNode) n).toList());
        assertEquals("Ace", ((Map<String, Object>) facts.get("awards")).get("biggestThief"), "v2: most jobs cracked");
        Map<String, Object> r = new Roast(off, TestSupport.BALANCE).roast(facts);
        assertEquals("template", r.get("source"));
        for (Map<String, Object> p : (List<Map<String, Object>>) r.get("players")) {
            int n = ((List<String>) p.get("lines")).size();
            assertTrue(n >= 4 && n <= 6, "lines: " + n);
        }
    }

    @Test
    void roastLinesAreSafetyFiltered() {
        assertFalse(Roast.safe("kiss the guard"));
        assertTrue(Roast.safe("cracked 12 locks"));
    }

    @Test
    void ttsFallsBackToTheGenericLineWithoutAKey() {
        Tts tts = new Tts(new ElevenLabs(null, null, null), TestSupport.BALANCE, TestSupport.ROOT);
        Tts.Result r = tts.line("named_winner_1", "Ace");
        assertTrue(r instanceof Tts.Fallback);
        Tts.Fallback f = (Tts.Fallback) r;
        assertTrue(f.lineId().startsWith("winner_"));
    }
}
