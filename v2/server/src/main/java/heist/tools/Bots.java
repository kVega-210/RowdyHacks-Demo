package heist.tools;

import heist.config.Balance;
import heist.util.Json;
import heist.util.Paths;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CLI for TL-01: {@code bots --url ws://localhost:7071/ws --room ABCD --count 6 [--success 0.7] [--spam]}.
 * Without --room it creates a room itself (acting as host), fills it and starts the game.
 */
public final class Bots {
    private Bots() {}

    public static void main(String[] args) throws Exception {
        Map<String, String> a = parse(args);
        String url = a.getOrDefault("url", "ws://localhost:" + System.getenv().getOrDefault("PORT", "7071") + "/ws");
        int count = Integer.parseInt(a.getOrDefault("count", "4"));
        Balance b = Balance.load(Paths.root());
        Bot.Config cfg = Bot.Config.fromBalance(b, Double.parseDouble(a.getOrDefault("scale", "1")));
        if (a.containsKey("success")) cfg.successRate = Double.parseDouble(a.get("success"));
        cfg.spamScans = a.containsKey("spam");
        if (a.containsKey("disconnect")) cfg.disconnectChance = Double.parseDouble(a.get("disconnect"));

        String room = a.get("room");
        HostClient host = null;
        if (room == null) {
            host = new HostClient(url, Json.obj("virtualKeys", true), m -> {
                String t = Json.str(m, "t", "");
                if (t.equals("phase_changed")) System.out.println("[host] phase " + Json.str(m, "phase", "") + " round " + m.path("round").asInt());
                if (t.equals("steal_result")) System.out.println("[host] " + Json.str(m, "thiefName", "") + " robbed " + Json.str(m, "victimName", "") + " for $" + m.path("amount").asLong());
                if (t.equals("final_standings")) System.out.println("[host] winner: " + Json.str(m, "winnerName", "?"));
            });
            room = host.room;
            System.out.println("Created room " + room);
        }
        List<Bot> bots = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Bot.Config c = Bot.Config.fromBalance(b, cfg.timeScale);
            c.successRate = cfg.successRate;
            c.spamScans = cfg.spamScans;
            c.disconnectChance = cfg.disconnectChance;
            c.seed = cfg.seed + i;
            bots.add(Bot.launch(url, room, "Bot" + (i + 1), c));
        }
        System.out.println(count + " bots joined " + room);
        if (host != null) {
            Thread.sleep(500);
            host.send(Json.msg("start_game"));
        }
        for (Bot bot : bots) bot.finished.await();
        System.out.println("Game over. Reconnects: " + bots.stream().mapToInt(x -> x.reconnects).sum());
        if (host != null) host.close();
        System.exit(0);
    }

    static Map<String, String> parse(String[] args) {
        Map<String, String> m = new java.util.HashMap<>();
        for (int i = 0; i < args.length; i++) {
            if (!args[i].startsWith("--")) continue;
            String k = args[i].substring(2);
            if (i + 1 < args.length && !args[i + 1].startsWith("--")) m.put(k, args[++i]);
            else m.put(k, "true");
        }
        return m;
    }
}
