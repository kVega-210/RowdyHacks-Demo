package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/** Loaded /content files the server needs: cards (PH-03) and flavor text (CT-03). */
public final class Content {
    public record Card(int number, String type, String effect, String title, String text, boolean physical) {
    }

    public final Map<Integer, Card> cards = new TreeMap<>();
    public final List<String> vaultNames = new ArrayList<>();
    public final List<String> teamNames = new ArrayList<>();
    public final List<String> aliases = new ArrayList<>();
    public final JsonNode flavor;

    public Content(Path root) {
        JsonNode cardsJson = readOrEmpty(root.resolve("content/cards.json"));
        for (JsonNode c : cardsJson.path("cards")) {
            Card card = new Card(c.path("number").asInt(), c.path("type").asText(), c.path("effect").asText(),
                    c.path("title").asText(), c.path("text").asText(), c.path("physical").asBoolean(false));
            cards.put(card.number(), card);
        }
        flavor = readOrEmpty(root.resolve("content/flavor.json"));
        flavor.path("vaultNames").forEach(n -> vaultNames.add(n.asText()));
        flavor.path("teamNames").forEach(n -> teamNames.add(n.asText()));
        flavor.path("aliases").forEach(n -> aliases.add(n.asText()));
    }

    public String vaultName(int vaultNo) {
        if (vaultNames.isEmpty()) return "Vault " + vaultNo;
        return vaultNames.get((vaultNo - 1) % vaultNames.size());
    }

    public String teamName(int i) {
        if (teamNames.isEmpty()) return "Crew " + (i + 1);
        return teamNames.get(i % teamNames.size());
    }

    private static JsonNode readOrEmpty(Path p) {
        try {
            return Files.exists(p) ? Json.MAPPER.readTree(Files.readString(p)) : Json.node();
        } catch (Exception e) {
            throw new IllegalStateException("Bad JSON in " + p, e);
        }
    }
}
