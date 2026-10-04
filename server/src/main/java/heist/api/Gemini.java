package heist.api;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/** Minimal Gemini REST client (generateContent with a JSON response). Key from GEMINI_API_KEY. */
public final class Gemini {
    private final String key;
    private final String model;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();

    public Gemini(String key, String model) {
        this.key = key == null || key.isBlank() ? null : key.trim();
        this.model = model == null || model.isBlank() ? "gemini-2.5-flash" : model.trim();
    }

    public static Gemini fromEnv() {
        return new Gemini(System.getenv("GEMINI_API_KEY"), System.getenv("GEMINI_MODEL"));
    }

    public boolean enabled() {
        return key != null;
    }

    /** Send a prompt, return the model's JSON answer. Throws on timeout, HTTP error or non-JSON output. */
    public JsonNode generateJson(String prompt, long timeoutMs) throws Exception {
        if (!enabled()) throw new IllegalStateException("GEMINI_API_KEY not set");
        var body = Json.obj(
                "contents", java.util.List.of(Json.obj("parts", java.util.List.of(Json.obj("text", prompt)))),
                "generationConfig", Json.obj("responseMimeType", "application/json", "temperature", 1.0));
        HttpRequest req = HttpRequest.newBuilder(URI.create("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent"))
                .timeout(Duration.ofMillis(timeoutMs))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", key)
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(body)))
                .build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() / 100 != 2) throw new IllegalStateException("Gemini HTTP " + res.statusCode());
        JsonNode root = Json.read(res.body());
        String text = root == null ? null : root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText(null);
        JsonNode out = text == null ? null : Json.read(text.replaceAll("^```(json)?|```$", "").trim());
        if (out == null) throw new IllegalStateException("Gemini returned no JSON");
        return out;
    }
}
