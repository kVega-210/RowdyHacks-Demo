package heist.tools;

import com.fasterxml.jackson.databind.JsonNode;
import heist.HeistServer;
import heist.config.Balance;
import heist.rooms.Room;
import heist.util.Clock;
import heist.util.Json;
import heist.util.Paths;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * IF-04 end-to-end smoke test. Boots the real server in-process with a sped-up clock, plays a full game
 * with a scripted host and 6 bots over real WebSockets, and asserts:
 * the bank never goes negative (and money is conserved), there is exactly one winner, and the event log
 * was written. Must finish in under 3 minutes. Exit code 0 = pass.
 */
public final class Smoke {
    private Smoke() {}

    public record Result(boolean passed, List<String> failures, long elapsedMs, Map<String, Object> summary) {
    }

    public static void main(String[] args) throws Exception {
        Map<String, String> a = Bots.parse(args);
        double scale = Double.parseDouble(a.getOrDefault("scale", "20"));
        int bots = Integer.parseInt(a.getOrDefault("bots", "6"));
        Result r = run(Paths.root(), scale, bots);
        System.out.println(Json.write(r.summary()));
        if (r.passed()) {
            System.out.println("SMOKE PASS in " + r.elapsedMs() / 1000.0 + "s");
            System.exit(0);
        }
        r.failures().forEach(f -> System.out.println("FAIL: " + f));
        System.exit(1);
    }

    public static Result run(Path root, double scale, int botCount) throws Exception {
        long t0 = System.currentTimeMillis();
        List<String> failures = new CopyOnWriteArrayList<>();
        Path events = Files.createTempDirectory("heist-smoke-events");
        HeistServer.Options o = new HeistServer.Options();
        o.root = root;
        o.port = 0;
        o.clock = Clock.scaled(scale);
        o.timeScale = scale;
        o.eventDir = events;
        o.databaseUrl = null;
        o.quiet = true;
        o.tickMs = 10;
        HeistServer server = new HeistServer(o).start();
        String url = "ws://127.0.0.1:" + server.port() + "/ws";
        Balance b = Balance.load(root);

        AtomicLong minBank = new AtomicLong(Long.MAX_VALUE);
        AtomicLong states = new AtomicLong();
        List<JsonNode> finals = new CopyOnWriteArrayList<>();
        HostClient host = new HostClient(url, Json.obj("virtualKeys", true), m -> {
            String t = Json.str(m, "t", "");
            if ("state".equals(t) && m.hasNonNull("bank")) {
                states.incrementAndGet();
                minBank.accumulateAndGet(m.path("bank").asLong(), Math::min);
            }
            if ("final_standings".equals(t)) finals.add(m);
        });
        Room room = server.rooms().get(host.room);
        // Server-side invariant check on every host-bound message (runs under the room lock).
        room.observe(m -> {
            String err = room.engine.invariantError();
            if (err != null && failures.size() < 5) failures.add("invariant broken after " + m.get("t") + ": " + err);
        });

        List<Bot> list = new ArrayList<>();
        for (int i = 0; i < botCount; i++) {
            Bot.Config c = Bot.Config.fromBalance(b, scale);
            c.seed = 1000 + i;
            c.disconnectChance = 0.05;
            list.add(Bot.launch(url, host.room, "Smoke" + (i + 1), c));
        }
        long deadline = System.currentTimeMillis() + 10_000;
        while (room.engine.players().size() < botCount && System.currentTimeMillis() < deadline) Thread.sleep(20);
        if (room.engine.players().size() != botCount) failures.add("only " + room.engine.players().size() + " bots joined");
        host.send(Json.msg("start_game"));

        long gameDeadline = t0 + 170_000;
        for (Bot bot : list) {
            long left = gameDeadline - System.currentTimeMillis();
            if (left <= 0 || !bot.finished.await(left, TimeUnit.MILLISECONDS)) {
                failures.add("game did not finish in time (phase " + room.engine.phase() + ", round " + room.engine.round() + ")");
                break;
            }
        }
        Thread.sleep(300);
        server.events().flush();

        // Assertions
        if (minBank.get() < 0) failures.add("bank went negative: " + minBank.get());
        if (states.get() == 0) failures.add("host never saw a state message");
        if (finals.isEmpty()) failures.add("host never got final_standings");
        else {
            JsonNode f = finals.get(0);
            long firsts = 0;
            for (JsonNode s : f.path("standings")) if (s.path("rank").asInt() == 1) firsts++;
            if (firsts != 1 || !f.hasNonNull("winnerId")) failures.add("expected exactly one winner, got " + firsts);
        }
        Path log = events.resolve(host.room + ".jsonl");
        long lines = Files.exists(log) ? Files.readAllLines(log).size() : 0;
        boolean hasEnd = Files.exists(log) && Files.readString(log).contains("\"type\":\"game_end\"");
        if (lines == 0 || !hasEnd) failures.add("event log missing or incomplete (" + lines + " lines, game_end=" + hasEnd + ")");
        long elapsed = System.currentTimeMillis() - t0;
        if (elapsed > 180_000) failures.add("took " + elapsed + "ms (> 3 minutes)");

        Map<String, Object> summary = Json.obj("room", host.room, "bots", botCount, "scale", scale, "elapsedMs", elapsed,
                "minBank", minBank.get(), "stateMessages", states.get(), "eventLines", lines,
                "reconnects", list.stream().mapToInt(x -> x.reconnects).sum(),
                "results", list.stream().mapToInt(x -> x.results).sum(),
                "winner", finals.isEmpty() ? null : finals.get(0).path("winnerName").asText(),
                "eventWriter", server.events().stats());
        host.close();
        list.forEach(Bot::stop);
        server.stop();
        return new Result(failures.isEmpty(), failures, elapsed, summary);
    }
}
