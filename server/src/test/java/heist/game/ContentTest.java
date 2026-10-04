package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.TestSupport;
import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ContentTest {
    @Test
    void fifteenCardsKeyedToBalanceWithOptOuts() {
        assertEquals(15, TestSupport.CONTENT.cards.size());
        for (Content.Card c : TestSupport.CONTENT.cards.values()) {
            assertTrue(TestSupport.BALANCE.has("cards." + c.effect()), "card " + c.number() + " effect " + c.effect() + " must exist in balance.json");
        }
    }

    @Test
    void narratorHasSixtyPlusLinesAndAtMostEightNamed() throws Exception {
        JsonNode n = Json.MAPPER.readTree(Files.readString(TestSupport.ROOT.resolve("content/narrator.json")));
        assertTrue(n.path("lines").size() >= 60);
        assertTrue(n.path("named").size() <= 8);
        for (JsonNode l : n.path("lines")) assertTrue(!l.path("text").asText().contains("{name}"), "plain lines have no slots");
        for (JsonNode l : n.path("named")) assertTrue(l.path("text").asText().contains("{name}"));
    }

    @Test
    void flavorHasTwentyVaultsAndAliases() {
        assertEquals(20, TestSupport.CONTENT.vaultNames.size());
        assertEquals(20, TestSupport.CONTENT.aliases.size());
    }
}
