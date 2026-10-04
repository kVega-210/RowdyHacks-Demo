package heist.rooms;

import com.fasterxml.jackson.databind.JsonNode;
import heist.game.GameEngine;
import heist.game.GameError;
import heist.game.Outbox;
import heist.game.PlayerState;
import heist.net.Conn;
import heist.session.Tokens;
import heist.util.Clock;
import heist.util.Json;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * BE-01 room: owns the engine, the host screens and the phone connections. Every engine call happens
 * while holding this object's monitor, which is what makes "first by server receive time" well defined.
 */
public final class Room implements Outbox {
    public final String code;
    public final String hostToken = Tokens.fresh();
    public final GameEngine engine;
    private final Clock clock;
    private final Tokens tokens = new Tokens();
    private final Map<String, Conn> phones = new ConcurrentHashMap<>();
    private final Set<Conn> hosts = ConcurrentHashMap.newKeySet();
    private final Consumer<Integer> botLauncher;
    private Consumer<Map<String, Object>> observer = m -> { };
    volatile long lastActivity = System.currentTimeMillis();

    Room(String code, Clock clock, java.util.function.Function<Outbox, GameEngine> engineFactory, Consumer<Integer> botLauncher) {
        this.code = code;
        this.clock = clock;
        this.engine = engineFactory.apply(this);
        this.botLauncher = botLauncher;
    }

    /** Test/smoke hook: sees every host-bound message. */
    public void observe(Consumer<Map<String, Object>> o) {
        this.observer = o;
    }

    // ---------------------------------------------------------------- Outbox

    @Override
    public void toPlayer(String playerId, Map<String, Object> msg) {
        Conn c = phones.get(playerId);
        if (c != null) c.send(msg);
    }

    @Override
    public void toHosts(Map<String, Object> msg) {
        observer.accept(msg);
        if (hosts.isEmpty()) return;
        String text = Json.write(msg);
        heist.net.PayloadMeter.GLOBAL.sent(String.valueOf(msg.get("t")), text.length());
        for (Conn h : hosts) h.sendRaw(text);
    }

    @Override
    public void toAll(Map<String, Object> msg) {
        String text = Json.write(msg);
        observer.accept(msg);
        for (Conn h : hosts) h.sendRaw(text);
        for (Conn c : phones.values()) {
            heist.net.PayloadMeter.GLOBAL.sent(String.valueOf(msg.get("t")), text.length());
            c.sendRaw(text);
        }
    }

    // ---------------------------------------------------------------- hosts

    public synchronized void attachHost(Conn c) {
        lastActivity = System.currentTimeMillis();
        c.role = "host";
        c.roomCode = code;
        hosts.add(c);
        c.send(Json.msg("welcome", "role", "host", "room", code, "hostToken", hostToken, "settings", engine.settings.toMap()));
        engine.resyncHost(c::send, clock.now());
    }

    public synchronized void handleHost(Conn c, JsonNode msg) {
        lastActivity = System.currentTimeMillis();
        long now = clock.now();
        String t = Json.str(msg, "t", "");
        switch (t) {
            case "start_game" -> engine.start(now);
            case "settings" -> {
                if (engine.phase() != heist.game.Phase.LOBBY) throw new GameError("game_in_progress", "Settings are locked once the heist starts");
                engine.settings.apply(msg.get("settings"));
                toHosts(Json.msg("settings", "settings", engine.settings.toMap()));
            }
            case "fill_bots" -> {
                int max = engine.balance().i("players.max");
                int n = (int) Math.max(0, Math.min(Json.lng(msg, "count", max - engine.players().size()), max - engine.players().size()));
                if (engine.phase() != heist.game.Phase.LOBBY) throw new GameError("game_in_progress", "Bots join in the lobby");
                if (n > 0) botLauncher.accept(n);
            }
            case "admin" -> {
                if ("kick".equals(Json.str(msg, "action", ""))) {
                    String pid = Json.str(msg, "playerId", "");
                    engine.admin(msg, now);
                    tokens.revokePlayer(pid);
                    Conn pc = phones.remove(pid);
                    if (pc != null) pc.close(4000, "kicked");
                } else {
                    engine.admin(msg, now);
                }
            }
            case "ping" -> c.send(Json.msg("pong", "now", now));
            default -> throw new GameError("unknown_intent", "Unknown host message " + t);
        }
    }

    public void detachHost(Conn c) {
        hosts.remove(c);
    }

    // ---------------------------------------------------------------- phones

    public synchronized void join(Conn c, String name, boolean bot) {
        lastActivity = System.currentTimeMillis();
        PlayerState p = engine.addPlayer(name, bot);
        bindPhone(c, p.id);
        String token = tokens.issue(p.id);
        c.send(Json.msg("welcome", "role", "phone", "room", code, "playerId", p.id, "name", p.name, "token", token,
                "face", p.face));
        engine.resync(p.id, clock.now());
    }

    public synchronized void resume(Conn c, String token) {
        lastActivity = System.currentTimeMillis();
        String pid = tokens.playerFor(token);
        PlayerState p = pid == null ? null : engine.players().get(pid);
        if (p == null) throw new GameError("bad_token", "Session expired. Join again.");
        Conn old = phones.get(pid);
        if (old != null && old != c) old.close(4001, "replaced by a newer connection");
        bindPhone(c, pid);
        engine.setConnected(pid, true, clock.now());
        c.send(Json.msg("welcome", "role", "phone", "room", code, "playerId", p.id, "name", p.name, "token", token,
                "face", p.face, "resumed", true));
        engine.resync(pid, clock.now());
    }

    private void bindPhone(Conn c, String pid) {
        c.role = "phone";
        c.roomCode = code;
        c.playerId = pid;
        phones.put(pid, c);
    }

    public synchronized void handlePhone(Conn c, JsonNode msg) {
        lastActivity = System.currentTimeMillis();
        String t = Json.str(msg, "t", "");
        if ("ping".equals(t)) {
            c.send(Json.msg("pong", "now", clock.now()));
            return;
        }
        if ("leave".equals(t)) {
            if (engine.phase() == heist.game.Phase.LOBBY) {
                engine.kick(c.playerId);
                tokens.revokePlayer(c.playerId);
                phones.remove(c.playerId);
            }
            return;
        }
        engine.handle(c.playerId, msg, clock.now());
    }

    public synchronized void phoneClosed(Conn c) {
        if (c.playerId == null) return;
        if (phones.get(c.playerId) == c) {
            phones.remove(c.playerId);
            engine.setConnected(c.playerId, false, clock.now());
        }
    }

    public synchronized void tick() {
        engine.tick(clock.now());
    }

    public boolean hasConnections() {
        return !hosts.isEmpty() || !phones.isEmpty();
    }

    public int phoneCount() {
        return phones.size();
    }

    public Clock clock() {
        return clock;
    }
}
