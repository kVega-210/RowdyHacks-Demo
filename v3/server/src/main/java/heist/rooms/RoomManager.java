package heist.rooms;

import heist.config.Balance;
import heist.db.EventLog;
import heist.game.Content;
import heist.game.GameEngine;
import heist.game.ModuleCatalog;
import heist.keys.KeySigner;
import heist.util.Clock;

import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/** Creates rooms with 4-letter codes, ticks them, and reaps idle ones. */
public final class RoomManager {
    private static final String LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O
    private static final long IDLE_MS = 30 * 60 * 1000L;

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final Path root;
    private final Balance balance;
    private final Clock clock;
    private final EventLog log;
    private final KeySigner signer;
    private final ScheduledExecutorService ticker = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "room-ticker");
        t.setDaemon(true);
        return t;
    });
    private BiConsumer<String, Integer> botLauncher = (room, n) -> { };
    private Consumer<GameEngine> onGameEnd = g -> { };

    public RoomManager(Path root, Balance balance, Clock clock, EventLog log, KeySigner signer) {
        this.root = root;
        this.balance = balance;
        this.clock = clock;
        this.log = log;
        this.signer = signer;
    }

    public void setBotLauncher(BiConsumer<String, Integer> launcher) {
        this.botLauncher = launcher;
    }

    public void onGameEnd(Consumer<GameEngine> cb) {
        this.onGameEnd = cb;
    }

    public void start(long tickMs) {
        ticker.scheduleAtFixedRate(this::tickAll, tickMs, tickMs, TimeUnit.MILLISECONDS);
    }

    public void stop() {
        ticker.shutdownNow();
    }

    private void tickAll() {
        long wall = System.currentTimeMillis();
        for (Room r : rooms.values()) {
            try {
                r.tick();
            } catch (Exception e) {
                System.err.println("[tick] room " + r.code + ": " + e);
            }
            if (!r.hasConnections() && wall - r.lastActivity > IDLE_MS) rooms.remove(r.code);
        }
    }

    public Room create(GameEngine.Settings settings) {
        String code;
        do {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < 4; i++) sb.append(LETTERS.charAt(random.nextInt(LETTERS.length())));
            code = sb.toString();
        } while (rooms.containsKey(code));
        final String c = code;
        Content content = new Content(root);
        var catalog = ModuleCatalog.scan(root.resolve("client/minigames"), "/minigames/");
        Room room = new Room(c, clock,
                outbox -> {
                    GameEngine g = new GameEngine(c, balance, outbox, log, catalog, content, signer, settings);
                    g.onGameEnd(onGameEnd);
                    return g;
                },
                n -> botLauncher.accept(c, n));
        rooms.put(c, room);
        return room;
    }

    /** v3 "New heist": a new lobby with the same settings and everyone who is still connected to {@code old}. */
    public Room rematch(Room old) {
        Room fresh = create(old.engine.settings.copy());
        try {
            old.moveTo(fresh);
        } catch (RuntimeException e) {
            rooms.remove(fresh.code);
            throw e;
        }
        return fresh;
    }

    public Room get(String code) {
        return code == null ? null : rooms.get(code.trim().toUpperCase());
    }

    public Collection<Room> all() {
        return rooms.values();
    }

    public Balance balance() {
        return balance;
    }
}
