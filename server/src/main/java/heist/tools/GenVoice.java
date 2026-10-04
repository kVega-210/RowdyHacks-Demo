package heist.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import heist.api.ElevenLabs;
import heist.api.Tts;
import heist.util.Json;
import heist.util.Paths;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * AU-02: read content/narrator.json, synthesise every line with ElevenLabs into client/host/audio/lines/,
 * and write manifest.json. Lines whose text+voice hash is unchanged are skipped, so re-running is cheap.
 * The API key comes from ELEVENLABS_API_KEY and is never written anywhere.
 */
public final class GenVoice {
    private GenVoice() {}

    public static void main(String[] args) throws Exception {
        Path root = Paths.root();
        ElevenLabs eleven = ElevenLabs.fromEnv();
        boolean dry = java.util.Arrays.asList(args).contains("--dry-run");
        if (!eleven.enabled() && !dry) {
            System.err.println("Set ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID). Use --dry-run to preview.");
            System.exit(2);
        }
        JsonNode narrator = Json.MAPPER.readTree(Files.readString(root.resolve("content/narrator.json")));
        Path outDir = root.resolve("client/host/audio/lines");
        Path manifestPath = root.resolve("client/host/audio/manifest.json");
        Files.createDirectories(outDir);
        ObjectNode old = Files.exists(manifestPath) ? (ObjectNode) Json.MAPPER.readTree(Files.readString(manifestPath)) : Json.node();
        ObjectNode manifest = Json.node();
        manifest.put("voice", eleven.voiceId);
        manifest.put("model", eleven.model());
        ObjectNode lines = manifest.putObject("lines");
        int made = 0, skipped = 0;
        for (JsonNode l : narrator.path("lines")) {
            String id = l.path("id").asText();
            String text = l.path("text").asText();
            String hash = Tts.hash(eleven.voiceId + "|" + eleven.model() + "|" + text);
            Path file = outDir.resolve(id + ".mp3");
            JsonNode prev = old.path("lines").path(id);
            ObjectNode entry = lines.putObject(id);
            entry.put("file", "/host/audio/lines/" + id + ".mp3");
            entry.put("event", l.path("event").asText());
            entry.put("hash", hash);
            if (hash.equals(prev.path("hash").asText()) && Files.exists(file)) {
                skipped++;
                continue;
            }
            if (dry) {
                System.out.println("would generate " + id + ": " + text);
                continue;
            }
            Files.write(file, eleven.speak(text, 30_000));
            made++;
            System.out.println("generated " + id);
        }
        if (!dry) Files.writeString(manifestPath, Json.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(manifest));
        System.out.println("done: " + made + " generated, " + skipped + " unchanged");
    }
}
