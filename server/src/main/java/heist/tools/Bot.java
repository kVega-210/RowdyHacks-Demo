package heist.tools;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.util.Json;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

/**
 * TL-01 protocol bot. Speaks exactly what a phone speaks: join, play (reporting results with a configurable
 * success rate), steal during Steal windows, sometimes twitch during Freeze, grab in Bank Raids, play cards,
 * sabotage, escape, and randomly drop and resume its connection with the session token.
 * All delays are in game milliseconds and divided by {@code timeScale}.
 */
public final class Bot {
    private static final ScheduledExecutorService TIMERS = Executors.newScheduledThreadPool(2, r -> {
        Thread t = new Thread(r, "bot-timer");
        t.setDaemon(true);
        return t;
    });
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    public static final class Config {
        public double successRate = 0.7;
        public long thinkMinMs = 1500;
        public long thinkMaxMs = 6000;
        public double scanChance = 0.5;
        public double freezeViolationChance = 0.15;
        public double escapeChance = 0.9;
        public double disconnectChance = 0.02;
        public double timeScale = 1.0;
        public boolean spamScans = false;
        public long seed = System.nanoTime();

        public static Config fromBalance(Balance b, double timeScale) {
            Config c = new Config();
            c.successRate = b.d("bots.successRate");
            c.thinkMinMs = b.l("bots.thinkMinMs");
            c.thinkMaxMs = b.l("bots.thinkMaxMs");
            c.scanChance = b.d("bots.scanChance");
            c.freezeViolationChance = b.d("bots.freezeViolationChance");
            c.escapeChance = b.d("bots.escapeChance");
            c.disconnectChance = b.d("bots.disconnectChance");
            c.timeScale = timeScale;
            return c;
        }
    }

    private final String url;
    private final String room;
    private final String name;
    private final Config cfg;
    private final Random rnd;
    private volatile WebSocket ws;
    private volatile String token;
    private volatile String playerId;
    private volatile List<String> others = List.of();
    private volatile boolean done;
    private volatile boolean reconnecting;
    public final CountDownLatch finished = new CountDownLatch(1);
    public volatile JsonNode finalStandings;
    public volatile int reconnects;
    public volatile int results;
    private Consumer<JsonNode> listener = m -> { };
    private ScheduledFuture<?> pinger;

    public Bot(String url, String room, String name, Config cfg) {
        this.url = url;
        this.room = room;
        this.name = name;
        this.cfg = cfg;
        this.rnd = new Random(cfg.seed ^ name.hashCode());
    }

    public static Bot launch(String url, String room, String name, Config cfg) {
        Bot b = new Bot(url, room, name, cfg);
        b.connect(false);
        return b;
    }

    public Bot onMessage(Consumer<JsonNode> l) {
        this.listener = l;
        return this;
    }

    public String playerId() {
        return playerId;
    }

    public void connect(boolean resume) {
        try {
            ws = HTTP.newWebSocketBuilder().buildAsync(URI.create(url), new Listener()).get(10, TimeUnit.SECONDS);
            send(resume ? Json.msg("resume", "room", room, "token", token) : Json.msg("join", "room", room, "name", name, "bot", true));
            if (pinger == null) {
                pinger = TIMERS.scheduleAtFixedRate(() -> send(Json.msg("ping")), 10, 10, TimeUnit.SECONDS);
            }
        } catch (Exception e) {
            System.err.println("[bot " + name + "] connect failed: " + e.getMessage());
            if (resume && !done) TIMERS.schedule(() -> connect(true), 1, TimeUnit.SECONDS);
        }
    }

    public void stop() {
        done = true;
        if (pinger != null) pinger.cancel(false);
        try {
            if (ws != null) ws.sendClose(WebSocket.NORMAL_CLOSURE, "bye");
        } catch (Exception ignored) {
            // closing anyway
        }
        finished.countDown();
    }

    synchronized void send(Map<String, Object> msg) {
        WebSocket w = ws;
        if (w == null || done && !"ping".equals(msg.get("t"))) return;
        try {
            w.sendText(Json.write(msg), true).get(5, TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // the socket dropped; reconnect logic will pick it up
        }
    }

    private void later(long gameMs, Runnable r) {
        long real = Math.max(1, (long) (gameMs / cfg.timeScale));
        TIMERS.schedule(() -> {
            try {
                r.run();
            } catch (Exception e) {
                System.err.println("[bot " + name + "] " + e);
            }
        }, real, TimeUnit.MILLISECONDS);
    }

    private long think() {
        return cfg.thinkMinMs + (long) (rnd.nextDouble() * (cfg.thinkMaxMs - cfg.thinkMinMs));
    }

    /** Test hook: kill the socket now and come back with the session token. */
    public void dropAndResumeForTest() {
        dropAndResume();
    }

    private void dropAndResume() {
        if (reconnecting || done || token == null) return;
        reconnecting = true;
        reconnects++;
        try {
            ws.abort();
        } catch (Exception ignored) {
            // already dead
        }
        later(1000 + rnd.nextInt(2000), () -> {
            reconnecting = false;
            connect(true);
        });
    }

    private void handle(JsonNode m) {
        listener.accept(m);
        String t = Json.str(m, "t", "");
        switch (t) {
            case "welcome" -> {
                token = Json.str(m, "token", token);
                playerId = Json.str(m, "playerId", playerId);
            }
            case "state" -> {
                List<String> ids = new ArrayList<>();
                for (JsonNode p : m.path("players")) if (!p.path("id").asText().equals(playerId)) ids.add(p.path("id").asText());
                others = ids;
            }
            case "minigame_assign" -> {
                String attempt = Json.str(m, "attemptId", "");
                if (rnd.nextDouble() < cfg.disconnectChance) {
                    dropAndResume();
                    return;
                }
                later(think(), () -> {
                    boolean ok = rnd.nextDouble() < cfg.successRate;
                    results++;
                    send(Json.msg("minigame_result", "attemptId", attempt, "success", ok,
                            "scoreMultiplier", 1 + rnd.nextInt(3) * 0.5, "reason", ok ? null : "bot fumbled",
                            "wager", Json.obj("tier", String.valueOf(1 + rnd.nextInt(3)))));
                });
            }
            case "steal_open" -> {
                if (cfg.spamScans) {
                    for (int i = 0; i < 6; i++) later(rnd.nextInt(800), this::scanSomeone);
                } else if (rnd.nextDouble() < cfg.scanChance) {
                    later(rnd.nextInt(2500), this::scanSomeone);
                }
            }
            case "freeze_start" -> {
                if (rnd.nextDouble() < cfg.freezeViolationChance) later(rnd.nextInt(2000), () -> send(Json.msg("freeze_violation")));
            }
            case "bankraid_open" -> later(200 + rnd.nextInt(2500), () -> send(Json.msg("bankraid_grab")));
            case "between" -> {
                if (m.path("sabotage").asBoolean() && rnd.nextDouble() < 0.35 && !others.isEmpty()) {
                    List<String> mods = new ArrayList<>();
                    m.path("modifiers").forEach(x -> mods.add(x.asText()));
                    if (!mods.isEmpty()) {
                        String target = others.get(rnd.nextInt(others.size()));
                        String mod = mods.get(rnd.nextInt(mods.size()));
                        later(500 + rnd.nextInt(3000), () -> send(Json.msg("sabotage", "targetId", target, "modifier", mod)));
                    }
                }
                if (rnd.nextDouble() < 0.15) later(500 + rnd.nextInt(2000), () -> send(Json.msg("card_play", "number", 1 + rnd.nextInt(15))));
            }
            case "card_vote_open" -> {
                if (!Json.str(m, "playerId", "").equals(playerId)) {
                    String vote = Json.str(m, "voteId", "");
                    later(500 + rnd.nextInt(4000), () -> send(Json.msg("card_vote", "voteId", vote, "pass", rnd.nextDouble() < 0.6)));
                }
            }
            case "hvh_power" -> {
                int uses = m.path("uses").asInt();
                for (int i = 0; i < uses; i++) later(2000 + rnd.nextInt(15000), () -> send(Json.msg("hack_scramble")));
            }
            case "escape_open" -> {
                if (rnd.nextDouble() < cfg.escapeChance) later(300 + rnd.nextInt(4000), () -> send(Json.msg("escape")));
            }
            case "final_standings" -> {
                finalStandings = m;
                done = true;
                if (pinger != null) pinger.cancel(false);
                finished.countDown();
            }
            case "kicked" -> stop();
            default -> { }
        }
    }

    private void scanSomeone() {
        List<String> o = others;
        if (o.isEmpty()) return;
        send(Json.msg("key_scan", "victim", o.get(rnd.nextInt(o.size()))));
    }

    private final class Listener implements WebSocket.Listener {
        private final StringBuilder buf = new StringBuilder();

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buf.append(data);
            if (last) {
                String text = buf.toString();
                buf.setLength(0);
                JsonNode m = Json.read(text);
                if (m != null) handle(m);
            }
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            if (!done && !reconnecting && statusCode != 4000 && webSocket == ws) dropAndResume();
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            if (!done && !reconnecting && webSocket == ws) dropAndResume();
        }
    }
}
