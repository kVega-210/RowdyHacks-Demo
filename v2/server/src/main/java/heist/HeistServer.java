package heist;

import com.fasterxml.jackson.databind.JsonNode;
import heist.api.Dares;
import heist.api.ElevenLabs;
import heist.api.Gemini;
import heist.api.Qr;
import heist.api.Roast;
import heist.api.Tts;
import heist.config.Balance;
import heist.db.EventStore;
import heist.db.EventWriter;
import heist.db.JdbcSink;
import heist.db.JsonlSink;
import heist.db.RoastInput;
import heist.db.Stats;
import heist.game.Content;
import heist.game.GameEngine;
import heist.game.GameError;
import heist.game.ModuleCatalog;
import heist.keys.KeySheet;
import heist.keys.KeySigner;
import heist.net.Conn;
import heist.net.PayloadMeter;
import heist.rooms.Room;
import heist.rooms.RoomManager;
import heist.tools.Bot;
import heist.util.Clock;
import heist.util.Json;
import io.javalin.Javalin;
import io.javalin.http.Context;
import io.javalin.http.staticfiles.Location;

import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/** Wires everything together: static clients, REST endpoints and the /ws game socket. */
public final class HeistServer {

    /** Startup options; defaults come from the environment (see .env.example). */
    public static final class Options {
        public int port = Integer.parseInt(env("PORT", "7071"));
        public Path root = heist.util.Paths.root();
        public Clock clock = Clock.system();
        public double timeScale = 1.0;
        public Path eventDir = null;
        public String databaseUrl = System.getenv("DATABASE_URL");
        public long tickMs = 20;
        public boolean quiet = false;
    }

    private final Options o;
    private final Balance balance;
    private final Content content;
    private final RoomManager rooms;
    private final EventWriter events;
    private final EventStore store;
    private final Gemini gemini = Gemini.fromEnv();
    private final ElevenLabs eleven = ElevenLabs.fromEnv();
    private final Roast roast;
    private final Dares dares;
    private final Tts tts;
    private final KeySigner signer = KeySigner.fromEnv();
    private final Map<String, Conn> conns = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> roastCache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService sweeper = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "conn-sweeper");
        t.setDaemon(true);
        return t;
    });
    private final long startedAt = System.currentTimeMillis();
    private Javalin app;

    public HeistServer(Options o) {
        this.o = o;
        this.balance = Balance.load(o.root);
        this.content = new Content(o.root);
        EventWriter.Sink sink;
        EventStore st;
        JdbcSink jdbc = null;
        if (o.databaseUrl != null && !o.databaseUrl.isBlank()) {
            try {
                jdbc = new JdbcSink(o.databaseUrl, o.root.resolve("server/db/schema.sql"));
            } catch (Exception e) {
                System.err.println("[events] DATABASE_URL unusable (" + e.getMessage() + "), falling back to JSONL");
            }
        }
        if (jdbc != null) {
            sink = jdbc;
            st = EventStore.jdbc(jdbc);
        } else {
            Path dir = o.eventDir != null ? o.eventDir : o.root.resolve("data/events");
            sink = new JsonlSink(dir);
            st = EventStore.jsonl(dir);
        }
        this.events = new EventWriter(sink);
        this.store = st;
        this.roast = new Roast(gemini, balance);
        this.dares = new Dares(gemini, balance, content);
        this.tts = new Tts(eleven, balance, o.root);
        this.rooms = new RoomManager(o.root, balance, o.clock, events, signer);
    }

    static String env(String k, String def) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? def : v;
    }

    public HeistServer start() {
        Path client = o.root.resolve("client");
        app = Javalin.create(config -> {
            config.showJavalinBanner = false;
            config.useVirtualThreads = true;
            config.router.ignoreTrailingSlashes = false;
            config.staticFiles.add(sf -> {
                sf.hostedPath = "/";
                sf.directory = client.toString();
                sf.location = Location.EXTERNAL;
                sf.headers = Map.of("Cache-Control", "no-cache");
            });
            for (String dir : List.of("shared", "content", "dev")) {
                config.staticFiles.add(sf -> {
                    sf.hostedPath = "/" + dir;
                    sf.directory = o.root.resolve(dir).toString();
                    sf.location = Location.EXTERNAL;
                    sf.headers = Map.of("Cache-Control", "no-cache");
                });
            }
        });
        routes(app);
        websocket(app);
        rooms.setBotLauncher(this::launchBots);
        rooms.onGameEnd(this::afterGame);
        rooms.start(o.tickMs);
        long stale = balance.l("net.staleMs");
        sweeper.scheduleAtFixedRate(() -> {
            long now = System.currentTimeMillis();
            for (Conn c : conns.values()) if (now - c.lastSeen > stale) c.close(4002, "heartbeat timeout");
        }, 5, 5, TimeUnit.SECONDS);
        app.start(o.port);
        if (!o.quiet) {
            System.out.println("HEIST HAVOC! running on " + publicUrl());
            System.out.println("  host screen : " + publicUrl() + "/host/");
            System.out.println("  phones      : " + publicUrl() + "/phone/");
            System.out.println("  sandbox     : " + publicUrl() + "/dev/minigame-sandbox/");
            System.out.println("  event log   : " + events.stats().get("sink"));
            System.out.println("  gemini=" + gemini.enabled() + " elevenlabs=" + eleven.enabled());
        }
        return this;
    }

    public int port() {
        return app.port();
    }

    public RoomManager rooms() {
        return rooms;
    }

    public EventWriter events() {
        return events;
    }

    public void stop() {
        rooms.stop();
        sweeper.shutdownNow();
        if (app != null) app.stop();
        events.close();
    }

    String publicUrl() {
        String env = System.getenv("PUBLIC_URL");
        if (env != null && !env.isBlank()) return env.replaceAll("/$", "");
        return "http://" + lanIp() + ":" + (app == null ? o.port : app.port());
    }

    static String lanIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) continue;
                for (var addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) return addr.getHostAddress();
                }
            }
        } catch (Exception ignored) {
            // fall through
        }
        return "localhost";
    }

    // ------------------------------------------------------------------ REST

    private void routes(Javalin app) {
        app.get("/health", ctx -> ctx.json(Json.obj("ok", true, "rooms", rooms.all().size(),
                "uptimeSec", (System.currentTimeMillis() - startedAt) / 1000, "events", events.stats())));
        app.get("/host", ctx -> ctx.redirect("/host/"));
        app.get("/phone", ctx -> ctx.redirect("/phone/"));
        app.get("/p", ctx -> ctx.redirect("/phone/"));
        app.get("/j/{room}", ctx -> ctx.redirect("/phone/?room=" + ctx.pathParam("room").replaceAll("[^A-Za-z]", "")));
        app.get("/replay", ctx -> ctx.redirect("/replay/"));

        app.get("/api/info", ctx -> ctx.json(Json.obj("publicUrl", publicUrl(), "minPlayers", balance.i("players.min"),
                "maxPlayers", balance.i("players.max"), "features", Json.obj("gemini", gemini.enabled(), "elevenlabs", eleven.enabled(),
                        "events", events.stats().get("sink")))));
        app.get("/api/rooms/{code}", ctx -> {
            Room r = rooms.get(ctx.pathParam("code"));
            if (r == null) ctx.status(404).json(Json.obj("error", "no_room"));
            else ctx.json(Json.obj("room", r.code, "phase", r.engine.phase().wire(), "players", r.engine.players().size(),
                    "virtualKeys", r.engine.settings.virtualKeys));
        });
        app.get("/api/minigames", ctx -> ctx.json(ModuleCatalog.scan(o.root.resolve("client/minigames"), "/minigames/")));
        app.get("/api/modifiers", ctx -> ctx.json(ModuleCatalog.scan(o.root.resolve("client/modifiers"), "/modifiers/")));
        app.get("/api/wagers", ctx -> ctx.json(ModuleCatalog.scan(o.root.resolve("client/wagers"), "/wagers/")));
        app.get("/api/qr", ctx -> {
            String text = ctx.queryParam("text");
            if (text == null || text.isEmpty() || text.length() > 512) {
                ctx.status(400).result("text required");
                return;
            }
            int size = Math.max(64, Math.min(1024, parseInt(ctx.queryParam("size"), 320)));
            ctx.contentType("image/png").header("Cache-Control", "max-age=3600").result(Qr.png(text, size));
        });
        app.get("/api/keys/sheet", ctx -> {
            if (!isLoopback(ctx)) {
                ctx.status(403).result("Key sheets are only served to localhost. Run scripts/gen-keys.sh instead.");
                return;
            }
            ctx.html(KeySheet.html(signer, content, parseInt(ctx.queryParam("count"), 8)));
        });
        app.get("/api/net/stats", ctx -> ctx.json(PayloadMeter.GLOBAL.snapshot()));
        app.get("/api/replay/{room}", ctx -> ctx.json(Stats.timeline(store.events(ctx.pathParam("room").toUpperCase()))));
        app.get("/api/stats/{room}", ctx -> ctx.json(Stats.perPlayer(store.events(ctx.pathParam("room").toUpperCase()))));
        app.get("/api/leaderboard", ctx -> ctx.json(Stats.leaderboard(store, 50)));
        app.get("/api/games", ctx -> ctx.json(store.finishedRooms(20)));
        app.get("/api/roast/{room}", ctx -> ctx.json(roastFor(ctx.pathParam("room").toUpperCase())));
        app.post("/api/roast", ctx -> {
            JsonNode body = Json.read(ctx.body());
            if (body == null || !body.path("players").isArray()) {
                ctx.status(400).json(Json.obj("error", "expected the DB-04 facts object"));
                return;
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> facts = Json.MAPPER.convertValue(body, Map.class);
            ctx.json(roast.roast(normalizeFacts(facts)));
        });
        app.get("/api/dares", ctx -> ctx.json(dares.get(Math.max(1, Math.min(10, parseInt(ctx.queryParam("count"), 3))))));
        app.get("/api/tts", ctx -> {
            Tts.Result r = tts.line(ctx.queryParam("id"), ctx.queryParam("name"));
            if (r instanceof Tts.Audio a) ctx.contentType("audio/mpeg").result(a.mp3());
            else ctx.json(tts.describe((Tts.Fallback) r));
        });
        app.exception(Exception.class, (e, ctx) -> {
            System.err.println("[http] " + ctx.path() + ": " + e);
            ctx.status(500).json(Json.obj("error", "internal"));
        });
    }

    /** Jackson reads JSON numbers as Integer; the roast templates expect Long counters. */
    @SuppressWarnings("unchecked")
    static Map<String, Object> normalizeFacts(Map<String, Object> facts) {
        Object ps = facts.get("players");
        if (ps instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m) {
                    Map<String, Object> mm = (Map<String, Object>) m;
                    for (String k : List.of("wins", "fails", "stealsMade", "timesRobbed", "lostAtEnd", "cashStolen")) {
                        Object v = mm.get(k);
                        mm.put(k, v instanceof Number n ? n.longValue() : 0L);
                    }
                }
            }
        }
        facts.putIfAbsent("awards", Json.obj());
        return facts;
    }

    private Map<String, Object> roastFor(String room) throws Exception {
        Map<String, Object> cached = roastCache.get(room);
        if (cached != null) return cached;
        events.flush();
        Map<String, Object> facts = RoastInput.build(store.events(room));
        Map<String, Object> r = roast.roast(facts);
        roastCache.put(room, r);
        return r;
    }

    private void afterGame(GameEngine g) {
        String room = g.roomId();
        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> r = roastFor(room);
                Room rm = rooms.get(room);
                if (rm != null) rm.toAll(Json.msg("roast", "roast", r));
            } catch (Exception e) {
                System.err.println("[roast] " + e.getMessage());
            }
        });
    }

    private static boolean isLoopback(Context ctx) {
        String ip = ctx.ip();
        return ip.startsWith("127.") || ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1");
    }

    private static int parseInt(String s, int def) {
        try {
            return s == null ? def : Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return def;
        }
    }

    // ------------------------------------------------------------------ WebSocket

    private void websocket(Javalin app) {
        double ips = balance.d("rateLimit.intentsPerSecond");
        double sps = balance.d("rateLimit.scansPerSecond");
        app.ws("/ws", ws -> {
            ws.onConnect(ctx -> {
                ctx.enableAutomaticPings(balance.l("net.heartbeatMs"), TimeUnit.MILLISECONDS);
                conns.put(ctx.sessionId(), new Conn(ctx, ips, sps));
            });
            ws.onMessage(ctx -> {
                Conn c = conns.get(ctx.sessionId());
                if (c == null) return;
                c.lastSeen = System.currentTimeMillis();
                String text = ctx.message();
                JsonNode msg = text.length() > 4096 ? null : Json.read(text);
                String t = msg == null ? "?" : Json.str(msg, "t", "?");
                PayloadMeter.GLOBAL.received(t, text.length());
                if (msg == null) {
                    c.send(Json.msg("error", "code", "bad_json", "message", "Messages must be JSON objects under 4KB"));
                    return;
                }
                if (!c.intents.allow() || ("key_scan".equals(t) && !c.scans.allow())) {
                    c.send(Json.msg("error", "code", "rate_limited", "message", "Slow down", "ref", t));
                    return;
                }
                try {
                    dispatch(c, t, msg);
                } catch (GameError e) {
                    c.send(Json.msg("error", "code", e.code, "message", e.getMessage(), "ref", t));
                } catch (Exception e) {
                    System.err.println("[ws] " + t + ": " + e);
                    c.send(Json.msg("error", "code", "internal", "message", "Server error", "ref", t));
                }
            });
            ws.onClose(ctx -> closed(ctx.sessionId()));
            ws.onError(ctx -> closed(ctx.sessionId()));
        });
    }

    private void closed(String sessionId) {
        Conn c = conns.remove(sessionId);
        if (c == null) return;
        c.markClosed();
        Room r = rooms.get(c.roomCode);
        if (r == null) return;
        if ("host".equals(c.role)) r.detachHost(c);
        else r.phoneClosed(c);
    }

    private void dispatch(Conn c, String t, JsonNode msg) {
        if ("ping".equals(t) && c.roomCode == null) {
            c.send(Json.msg("pong", "now", o.clock.now()));
            return;
        }
        if (c.roomCode == null) {
            switch (t) {
                case "create_room" -> {
                    GameEngine.Settings s = new GameEngine.Settings();
                    s.apply(msg.get("settings"));
                    rooms.create(s).attachHost(c);
                }
                case "host_resume" -> {
                    Room r = room(msg);
                    if (!r.hostToken.equals(Json.str(msg, "hostToken", ""))) throw new GameError("bad_token", "Not the host of this room");
                    r.attachHost(c);
                }
                case "join" -> room(msg).join(c, Json.str(msg, "name", ""), Json.bool(msg, "bot", false));
                case "resume" -> room(msg).resume(c, Json.str(msg, "token", ""));
                default -> throw new GameError("not_joined", "Join or create a room first");
            }
            return;
        }
        Room r = rooms.get(c.roomCode);
        if (r == null) throw new GameError("no_room", "Room closed");
        if ("host".equals(c.role)) r.handleHost(c, msg);
        else r.handlePhone(c, msg);
    }

    private Room room(JsonNode msg) {
        Room r = rooms.get(Json.str(msg, "room", ""));
        if (r == null) throw new GameError("no_room", "No room with that code");
        return r;
    }

    // ------------------------------------------------------------------ bots (offline demo mode)

    private void launchBots(String room, int count) {
        String url = "ws://127.0.0.1:" + app.port() + "/ws";
        List<String> names = content.aliases.isEmpty() ? List.of("Bot") : content.aliases;
        Room r = rooms.get(room);
        int existing = r == null ? 0 : r.engine.players().size();
        // Called under the room lock: connect on other threads so the bots' join can take the lock afterwards.
        for (int i = 0; i < count; i++) {
            Bot.Config cfg = Bot.Config.fromBalance(balance, o.timeScale);
            String name = names.get((existing + i) % names.size());
            Thread.ofVirtual().name("bot-" + name).start(() -> Bot.launch(url, room, name, cfg));
        }
    }
}
