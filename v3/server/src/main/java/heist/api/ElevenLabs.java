package heist.api;

import heist.util.Json;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** ElevenLabs text-to-speech. Key from ELEVENLABS_API_KEY; never committed. */
public final class ElevenLabs {
    public static final String DEFAULT_VOICE = "pFZP5JQG7iQjIQuC4Bku";

    private final String key;
    public final String voiceId;
    private final String model;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public ElevenLabs(String key, String voiceId, String model) {
        this.key = key == null || key.isBlank() ? null : key.trim();
        this.voiceId = voiceId == null || voiceId.isBlank() ? DEFAULT_VOICE : voiceId.trim();
        this.model = model == null || model.isBlank() ? "eleven_multilingual_v2" : model.trim();
    }

    public static ElevenLabs fromEnv() {
        return new ElevenLabs(System.getenv("ELEVENLABS_API_KEY"), System.getenv("ELEVENLABS_VOICE_ID"), System.getenv("ELEVENLABS_MODEL"));
    }

    public boolean enabled() {
        return key != null;
    }

    public String model() {
        return model;
    }

    public byte[] speak(String text, long timeoutMs) throws Exception {
        if (!enabled()) throw new IllegalStateException("ELEVENLABS_API_KEY not set");
        HttpRequest req = HttpRequest.newBuilder(URI.create("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId + "?output_format=mp3_44100_128"))
                .timeout(Duration.ofMillis(timeoutMs))
                .header("Content-Type", "application/json")
                .header("Accept", "audio/mpeg")
                .header("xi-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(Json.obj("text", text, "model_id", model,
                        "voice_settings", Json.obj("stability", 0.4, "similarity_boost", 0.8, "style", 0.6)))))
                .build();
        HttpResponse<byte[]> res = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        if (res.statusCode() / 100 != 2) throw new IllegalStateException("ElevenLabs HTTP " + res.statusCode());
        return res.body();
    }
}
