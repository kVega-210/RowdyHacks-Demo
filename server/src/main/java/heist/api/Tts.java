package heist.api;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.util.Json;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

/**
 * AU-04 personalised narrator lines ("{name} takes the crown"). Proxies ElevenLabs with a disk cache and a
 * hard 1.5s timeout; on any miss it answers with the generic pre-generated line for the same event.
 */
public final class Tts {
    public sealed interface Result permits Audio, Fallback {
    }

    public record Audio(byte[] mp3) implements Result {
    }

    public record Fallback(String lineId, String text) implements Result {
    }

    private final ElevenLabs eleven;
    private final Balance b;
    private final Path root;
    private final Path cacheDir;

    public Tts(ElevenLabs eleven, Balance b, Path root) {
        this.eleven = eleven;
        this.b = b;
        this.root = root;
        this.cacheDir = root.resolve("data/tts-cache");
    }

    public Result line(String id, String name) {
        JsonNode narrator = Json.read(read(root.resolve("content/narrator.json")));
        JsonNode named = null;
        if (narrator != null) for (JsonNode n : narrator.path("named")) if (n.path("id").asText().equals(id)) named = n;
        if (named == null) return new Fallback(null, null);
        String safeName = name == null ? "" : name.replaceAll("[^\\p{L}\\p{N} '\\-]", "").trim();
        if (safeName.length() > 16) safeName = safeName.substring(0, 16);
        String text = named.path("text").asText().replace("{name}", safeName.isEmpty() ? "Someone" : safeName);
        Fallback fallback = genericFor(narrator, named.path("event").asText(), text);
        if (!eleven.enabled()) return fallback;
        try {
            Path cached = cacheDir.resolve(hash(eleven.voiceId + "|" + eleven.model() + "|" + text) + ".mp3");
            if (Files.exists(cached)) return new Audio(Files.readAllBytes(cached));
            byte[] mp3 = eleven.speak(text, b.l("ai.ttsTimeoutMs"));
            Files.createDirectories(cacheDir);
            Files.write(cached, mp3);
            return new Audio(mp3);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static Fallback genericFor(JsonNode narrator, String event, String namedText) {
        for (JsonNode l : narrator.path("lines")) {
            if (l.path("event").asText().equals(event)) return new Fallback(l.path("id").asText(), l.path("text").asText());
        }
        return new Fallback(null, namedText);
    }

    public static String hash(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8))).substring(0, 24);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String read(Path p) {
        try {
            return Files.readString(p);
        } catch (Exception e) {
            return "{}";
        }
    }

    public Map<String, Object> describe(Fallback f) {
        return Json.obj("fallback", true, "lineId", f.lineId(), "text", f.text());
    }
}
