package heist.tools;

import com.fasterxml.jackson.databind.JsonNode;
import heist.HeistServer;
import heist.TestSupport;
import heist.game.Phase;
import heist.game.PlayerState;
import heist.rooms.Room;
import heist.util.Clock;
import heist.util.Json;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Over real WebSockets: BE-01 (4 bots join, roster on host), BE-02 (bot killed mid-round resumes), HTTP endpoints. */
class ServerIntegrationTest {
    static HeistServer server;
    static String ws;
    static String http;

    @BeforeAll
    static void boot() throws Exception {
        HeistServer.Options o = new HeistServer.Options();
        o.root = TestSupport.ROOT;
        o.port = 0;
        o.clock = Clock.scaled(10);
        o.timeScale = 10;
        o.eventDir = Files.createTempDirectory("it-events");
        o.databaseUrl = null;
        o.quiet = true;
        server = new HeistServer(o).start();
        ws = "ws://127.0.0.1:" + server.port() + "/ws";
        http = "http://127.0.0.1:" + server.port();
    }

    @AfterAll
    static void down() {
        server.stop();
    }

    static void waitFor(java.util.function.BooleanSupplier c, long ms) throws InterruptedException {
        long end = System.currentTimeMillis() + ms;
        while (!c.getAsBoolean() && System.currentTimeMillis() < end) Thread.sleep(20);
        assertTrue(c.getAsBoolean(), "condition not met in " + ms + "ms");
    }

    @Test
    void fourBotsJoinAndTheRosterShowsOnTheHost() throws Exception {
        List<JsonNode> seen = new CopyOnWriteArrayList<>();
        HostClient host = new HostClient(ws, Json.obj(), seen::add);
        List<Bot> bots = new ArrayList<>();
        for (int i = 0; i < 4; i++) bots.add(Bot.launch(ws, host.room, "B" + i, new Bot.Config()));
        waitFor(() -> seen.stream().anyMatch(m -> "state".equals(m.path("t").asText()) && m.path("players").size() == 4), 5000);
        bots.forEach(Bot::stop);
        host.close();
    }

    @Test
    void killingABotMidRoundResumesItWithWalletIntact() throws Exception {
        HostClient host = new HostClient(ws, Json.obj(), m -> { });
        Room room = server.rooms().get(host.room);
        Bot.Config cfg = new Bot.Config();
        cfg.timeScale = 10;
        cfg.disconnectChance = 0;
        Bot a = Bot.launch(ws, host.room, "Alpha", cfg);
        Bot b = Bot.launch(ws, host.room, "Bravo", cfg);
        waitFor(() -> room.engine.players().size() == 2, 5000);
        host.send(Json.msg("start_game"));
        waitFor(() -> room.engine.phase() == Phase.PLAY, 5000);
        PlayerState p = room.engine.players().get(a.playerId());
        synchronized (room) {
            room.engine.admin(Json.MAPPER.valueToTree(Json.obj("action", "grant", "playerId", p.id, "amount", 400)), room.clock().now());
        }
        long wallet = p.wallet;
        a.dropAndResumeForTest();
        waitFor(() -> !p.connected, 3000);
        waitFor(() -> p.connected, 8000);
        assertTrue(p.wallet >= wallet - TestSupport.BALANCE.l("freeze.violationPenalty") - 1000, "wallet survived the reconnect");
        waitFor(() -> a.reconnects == 1 && a.results > 0, 8000);
        a.stop();
        b.stop();
        host.close();
    }

    @Test
    void httpEndpoints() throws Exception {
        HttpClient c = HttpClient.newHttpClient();
        HttpResponse<String> health = c.send(HttpRequest.newBuilder(URI.create(http + "/health")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(200, health.statusCode());
        assertTrue(health.body().contains("\"ok\":true"));
        HttpResponse<String> games = c.send(HttpRequest.newBuilder(URI.create(http + "/api/minigames")).build(), HttpResponse.BodyHandlers.ofString());
        assertEquals(34, Json.read(games.body()).size());
        HttpResponse<byte[]> qr = c.send(HttpRequest.newBuilder(URI.create(http + "/api/qr?text=HK1-ABCDEF")).build(), HttpResponse.BodyHandlers.ofByteArray());
        assertEquals("image/png", qr.headers().firstValue("content-type").orElse(""));
        HttpResponse<String> phone = c.send(HttpRequest.newBuilder(URI.create(http + "/phone/")).build(), HttpResponse.BodyHandlers.ofString());
        assertTrue(phone.body().contains("/phone/app.js"));
        HttpResponse<String> balance = c.send(HttpRequest.newBuilder(URI.create(http + "/shared/balance.json")).build(), HttpResponse.BodyHandlers.ofString());
        assertTrue(balance.body().contains("startPerPlayer"));
    }
}
