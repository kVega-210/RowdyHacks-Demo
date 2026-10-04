package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/** Loaded /content files the server needs: flavor text (CT-03). v2: the card deck was removed. */
public final class Content {
    public final List<String> vaultNames = new ArrayList<>();
    public final List<String> teamNames = new ArrayList<>();
    public final List<String> aliases = new ArrayList<>();
    /** v2: player faces (flavor.json "animalFaces"); the defaults are used when the file has none. */
    public final List<String> animalFaces = new ArrayList<>();
    private static final List<String> DEFAULT_FACES = List.of("🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
            "🦁", "🐮", "🐷", "🐸", "🐵", "🐺", "🐗", "🐴", "🦄", "🐲");
    public final JsonNode flavor;

    public Content(Path root) {
        flavor = readOrEmpty(root.resolve("content/flavor.json"));
        flavor.path("vaultNames").forEach(n -> vaultNames.add(n.asText()));
        flavor.path("teamNames").forEach(n -> teamNames.add(n.asText()));
        flavor.path("aliases").forEach(n -> aliases.add(n.asText()));
        flavor.path("animalFaces").forEach(n -> animalFaces.add(n.asText()));
        if (animalFaces.isEmpty()) animalFaces.addAll(DEFAULT_FACES);
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
