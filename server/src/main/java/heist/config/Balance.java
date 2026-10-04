package heist.config;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Read-only view of /shared/balance.json. Every gameplay number goes through here (DOC-04).
 * Paths are dot separated, e.g. {@code i("rounds.playMs")}. A missing key is a startup error,
 * never a silent default.
 */
public final class Balance {
    private final JsonNode root;

    public Balance(JsonNode root) {
        this.root = root;
    }

    public static Balance load(Path repoRoot) {
        try {
            return new Balance(Json.MAPPER.readTree(Files.readString(repoRoot.resolve("shared/balance.json"))));
        } catch (Exception e) {
            throw new IllegalStateException("Cannot read shared/balance.json", e);
        }
    }

    public JsonNode node(String path) {
        JsonNode n = root;
        for (String part : path.split("\\.")) {
            n = n.get(part);
            if (n == null) throw new IllegalArgumentException("balance.json is missing " + path);
        }
        return n;
    }

    public boolean has(String path) {
        JsonNode n = root;
        for (String part : path.split("\\.")) {
            n = n.get(part);
            if (n == null) return false;
        }
        return true;
    }

    public int i(String path) {
        return node(path).asInt();
    }

    public long l(String path) {
        return node(path).asLong();
    }

    public double d(String path) {
        return node(path).asDouble();
    }

    public boolean b(String path) {
        return node(path).asBoolean();
    }

    public String s(String path) {
        return node(path).asText();
    }

    public List<String> strings(String path) {
        List<String> out = new ArrayList<>();
        node(path).forEach(n -> out.add(n.asText()));
        return out;
    }

    public List<Integer> ints(String path) {
        List<Integer> out = new ArrayList<>();
        node(path).forEach(n -> out.add(n.asInt()));
        return out;
    }

    public List<Double> doubles(String path) {
        List<Double> out = new ArrayList<>();
        node(path).forEach(n -> out.add(n.asDouble()));
        return out;
    }

    public JsonNode raw() {
        return root;
    }
}
