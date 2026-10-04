package heist.tools;

import com.fasterxml.jackson.databind.JsonNode;
import heist.util.Json;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/** A scripted host screen used by the bots CLI and the smoke test. */
public final class HostClient {
    private final WebSocket ws;
    public volatile String room;
    public final CountDownLatch welcomed = new CountDownLatch(1);
    private final Consumer<JsonNode> listener;

    public HostClient(String url, Map<String, Object> settings, Consumer<JsonNode> listener) throws Exception {
        this.listener = listener;
        this.ws = HttpClient.newHttpClient().newWebSocketBuilder().buildAsync(URI.create(url), new WebSocket.Listener() {
            private final StringBuilder buf = new StringBuilder();

            @Override
            public CompletionStage<?> onText(WebSocket w, CharSequence data, boolean last) {
                buf.append(data);
                if (last) {
                    JsonNode m = Json.read(buf.toString());
                    buf.setLength(0);
                    if (m != null) handle(m);
                }
                w.request(1);
                return CompletableFuture.completedFuture(null);
            }
        }).get(10, TimeUnit.SECONDS);
        send(Json.msg("create_room", "settings", settings));
        if (!welcomed.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("host was not welcomed");
    }

    private void handle(JsonNode m) {
        if ("welcome".equals(Json.str(m, "t", ""))) {
            room = Json.str(m, "room", null);
            welcomed.countDown();
        }
        listener.accept(m);
    }

    public synchronized void send(Map<String, Object> msg) {
        try {
            ws.sendText(Json.write(msg), true).get(5, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public void close() {
        try {
            ws.sendClose(WebSocket.NORMAL_CLOSURE, "bye");
        } catch (Exception ignored) {
            // closing
        }
    }
}
