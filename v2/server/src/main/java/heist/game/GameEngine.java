package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.db.EventLog;
import heist.keys.KeySigner;
import heist.util.Clock;
import heist.util.Json;
import heist.util.Rng;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;

/**
 * One room's authoritative game. Not thread safe: the owning Room serialises every call under its lock,
 * so "server receive order" is simply call order. Time only comes from the injected Clock via the
 * {@code now} arguments, which makes the whole engine drivable from unit tests with a manual clock.
 */
public final class GameEngine {

    /** Host-chosen room settings. */
    public static final class Settings {
        public boolean virtualKeys = true;
        public boolean teams = false;
        public int rounds = -1;
        public List<String> games = null;
        public Long seed = null;

        public void apply(JsonNode s) {
            if (s == null) return;
            if (s.has("virtualKeys")) virtualKeys = s.get("virtualKeys").asBoolean(virtualKeys);
            if (s.has("teams")) teams = s.get("teams").asBoolean(teams);
            if (s.has("rounds") && s.get("rounds").canConvertToInt()) rounds = Math.max(1, Math.min(12, s.get("rounds").asInt()));
            if (s.has("games") && s.get("games").isArray()) {
                List<String> g = new ArrayList<>();
                s.get("games").forEach(n -> g.add(n.asText()));
                games = g.isEmpty() ? null : g;
            }
            if (s.has("seed") && s.get("seed").canConvertToLong()) seed = s.get("seed").asLong();
        }

        public Map<String, Object> toMap() {
            return Json.obj("virtualKeys", virtualKeys, "teams", teams, "rounds", rounds, "games", games);
        }
    }

    private final String roomId;
    private final Balance b;
    private final Outbox out;
    private final EventLog log;
    private final List<ModuleCatalog.Info> catalog;
    private final Content content;
    private final KeySigner signer;
    public final Settings settings;
    private Rng rng;

    private final Map<String, PlayerState> players = new LinkedHashMap<>();
    private int joinCounter;
    private int idCounter;

    private Phase phase = Phase.LOBBY;
    private int round;
    private long phaseEndsAt = -1;
    private RoundTypes.RoundType roundType;
    private double speed = 1.0;
    private int difficulty = 1;
    private Economy.Ledger ledger;
    private final Set<Double> warned = new HashSet<>();
    private boolean bankZeroAnnounced;

    // Play phase state
    private long playStartedAt;
    private List<EventScheduler.Scheduled> plan = List.of();
    private int planIdx;
    private final Set<Integer> freezeWarned = new HashSet<>();
    private StealArbiter steal;
    private long freezeStart = -1;
    private long freezeEndsAt = -1;
    private final Set<String> freezeViolators = new HashSet<>();
    private BankRaid raid;
    private RivalHeist rival;
    private HackerVsHacker hvh;
    private Map<String, String> targets = new HashMap<>();
    private Map<String, String> teamOf = new LinkedHashMap<>();
    private final Map<String, Long> walletAtRoundStart = new HashMap<>();

    // Between phase
    private final Map<String, Cards.Vote> votes = new LinkedHashMap<>();
    private int seq;

    // Outbound throttling
    private boolean dirty = true;
    private long lastStateAt = -1;

    private Map<String, Object> finalStandings;
    private Consumer<GameEngine> onGameEnd = g -> { };

    public GameEngine(String roomId, Balance balance, Outbox out, EventLog log, List<ModuleCatalog.Info> catalog,
                      Content content, KeySigner signer, Settings settings) {
        this.roomId = roomId;
        this.b = balance;
        this.out = out;
        this.log = log == null ? EventLog.NOOP : log;
        this.catalog = catalog;
        this.content = content;
        this.signer = signer;
        this.settings = settings == null ? new Settings() : settings;
        this.rng = new Rng(this.settings.seed != null ? this.settings.seed : System.nanoTime());
    }

    public void onGameEnd(Consumer<GameEngine> cb) {
        this.onGameEnd = cb;
    }

    // ------------------------------------------------------------------ lobby

    public PlayerState addPlayer(String rawName, boolean bot) {
        if (phase != Phase.LOBBY) throw new GameError("game_in_progress", "The heist already started");
        if (players.size() >= b.i("players.max")) throw new GameError("room_full", "Room is full");
        String name = cleanName(rawName);
        if (name.isEmpty()) throw new GameError("bad_name", "Pick a name");
        for (PlayerState p : players.values()) {
            if (p.name.equalsIgnoreCase(name)) name = name + (players.size() + 1);
        }
        PlayerState p = new PlayerState("p" + (++idCounter), name, ++joinCounter, bot);
        players.put(p.id, p);
        if (settings.virtualKeys || bot) giveVirtualKey(p);
        log.log(roomId, 0, p.id, "join", Json.obj("name", name, "bot", bot));
        dirty = true;
        return p;
    }

    static String cleanName(String raw) {
        if (raw == null) return "";
        String n = raw.replaceAll("[\\p{Cntrl}<>]", "").trim();
        return n.length() > 16 ? n.substring(0, 16) : n;
    }

    private void giveVirtualKey(PlayerState p) {
        if (p.keyCode != null) return;
        int n = freeVault();
        p.vaultNo = n;
        p.vaultName = content.vaultName(n);
        p.keyCode = signer.code(n);
    }

    private int freeVault() {
        Set<Integer> used = new HashSet<>();
        players.values().forEach(x -> used.add(x.vaultNo));
        for (int i = 1; ; i++) if (!used.contains(i)) return i;
    }

    /** Scan a physical key tag at join to claim its vault (CL-06). */
    public void claimKey(String pid, String code) {
        PlayerState p = player(pid);
        int n = signer.verify(code);
        if (n < 1) throw new GameError("bad_key", "That key is not one of ours");
        for (PlayerState o : players.values()) {
            if (o != p && o.vaultNo == n) throw new GameError("key_taken", "Someone already claimed that vault");
        }
        p.vaultNo = n;
        p.vaultName = content.vaultName(n);
        p.keyCode = signer.code(n);
        out.toPlayer(pid, Json.msg("key_claimed", "vault", n, "vaultName", p.vaultName));
        log.log(roomId, round, pid, "key_claim", Json.obj("vault", n));
        dirty = true;
    }

    public void setConnected(String pid, boolean on, long now) {
        PlayerState p = players.get(pid);
        if (p == null) return;
        p.connected = on;
        p.disconnectedAt = on ? -1 : now;
        log.log(roomId, round, pid, on ? "reconnect" : "disconnect", Json.obj());
        dirty = true;
    }

    public void start(long now) {
        if (phase != Phase.LOBBY) throw new GameError("game_in_progress", "Already started");
        if (players.size() < b.i("players.min")) throw new GameError("not_enough_players", "Need at least " + b.i("players.min") + " players");
        if (settings.seed == null) rng = new Rng(now ^ System.nanoTime());
        for (PlayerState p : players.values()) giveVirtualKey(p);
        if (settings.teams) {
            teamOf = Teams.form(b, rng, new ArrayList<>(players.keySet()), content);
            teamOf.forEach((id, t) -> players.get(id).team = t);
        }
        ledger = new Economy.Ledger(b.l("bank.startPerPlayer") * players.size());
        log.log(roomId, 0, null, "game_start", Json.obj("players", players.size(), "bank", ledger.bank, "settings", settings.toMap()));
        enter(Phase.BRIEFING, 1, now);
    }

    // ------------------------------------------------------------------ clock

    public void tick(long now) {
        if (phase == Phase.PLAY) {
            long warnMs = b.l("freeze.warningMs");
            for (int i = planIdx; i < plan.size(); i++) {
                EventScheduler.Scheduled e = plan.get(i);
                if (e.kind() == EventScheduler.Kind.FREEZE && !freezeWarned.contains(i) && now >= playStartedAt + e.atMs() - warnMs) {
                    freezeWarned.add(i);
                    out.toAll(Json.msg("freeze_warning", "startsAt", playStartedAt + e.atMs(), "now", now, "ms", warnMs));
                }
            }
            while (planIdx < plan.size() && playStartedAt + plan.get(planIdx).atMs() <= now) {
                EventScheduler.Scheduled e = plan.get(planIdx++);
                openEvent(e.kind(), now, e.durationMs());
            }
            closeExpiredWindows(now);
            for (PlayerState p : players.values()) {
                if (p.attempt == null && p.nextAssignAt >= 0 && now >= p.nextAssignAt && p.connected) assign(p, now);
            }
        }
        if (phase == Phase.BETWEEN) {
            for (Cards.Vote v : new ArrayList<>(votes.values())) if (now >= v.endsAt) resolveVote(v, false, now);
        }
        if (phaseEndsAt >= 0 && now >= phaseEndsAt && phase != Phase.LOBBY && phase != Phase.END) advance(now);
        long minGap = 1000L / Math.max(1, b.i("net.maxStateHz"));
        if (dirty && (lastStateAt < 0 || now - lastStateAt >= minGap)) broadcastState(now);
    }

    private void advance(long now) {
        RoundMachine.Step s = RoundMachine.next(phase, round, totalRounds(), ledger != null && ledger.bankEmpty());
        enter(s.phase(), s.round(), now);
    }

    public int totalRounds() {
        return settings.rounds > 0 ? settings.rounds : b.i("rounds.count");
    }

    private void enter(Phase next, int r, long now) {
        // Leaving a phase
        if (phase == Phase.PLAY) endPlay(now);
        if (phase == Phase.BETWEEN) {
            for (Cards.Vote v : new ArrayList<>(votes.values())) resolveVote(v, false, now);
        }
        phase = next;
        round = r;
        long dur = RoundMachine.durationMs(b, next);
        phaseEndsAt = dur > 0 ? now + dur : -1;
        if (next == Phase.BRIEFING) {
            roundType = RoundTypes.forRound(b, r, players.size());
            speed = Speed.forRound(b, r);
            difficulty = RoundMachine.difficulty(b, r);
        }
        out.toAll(Json.msg("phase_changed", "phase", next.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "banner", roundType == null ? null : roundType.banner(),
                "endsAt", phaseEndsAt, "now", now));
        switch (next) {
            case BRIEFING -> setupRound(now);
            case PLAY -> startPlay(now);
            case RESULTS -> finishRound(now);
            case BETWEEN -> startBetween(now);
            case ESCAPE -> startEscape(now);
            case END -> finishGame(now);
            default -> { }
        }
        dirty = true;
        broadcastState(now);
    }

    // ------------------------------------------------------------------ rounds

    private void setupRound(long now) {
        List<String> ids = new ArrayList<>(players.keySet());
        for (PlayerState p : players.values()) {
            p.roundEarnings = 0;
            p.attempt = null;
            p.nextAssignAt = -1;
            p.keyStolen = false;
            p.keyHeldBy = null;
            p.jammedUntil = -1;
            p.activeModifiers = new ArrayList<>(p.pendingModifiers);
            p.pendingModifiers.clear();
            walletAtRoundStart.put(p.id, p.wallet);
        }
        targets = Targets.assign(rng, ids, teamOf);
        players.values().forEach(p -> p.target = targets.get(p.id));

        rival = null;
        if ("rival".equals(roundType.id()) && ids.size() >= 2) {
            List<String> pair = rng.shuffled(ids).subList(0, 2);
            ModuleCatalog.Info g = pickGame(List.of("classic", "cyber"), true);
            rival = new RivalHeist(pair.get(0), pair.get(1), g == null ? null : g.id(), rng.seed());
        }
        hvh = null;
        if (b.ints("hackerVsHacker.rounds").contains(round) && ids.size() >= 2) {
            List<String> pair = rng.shuffled(ids).subList(0, 2);
            hvh = new HackerVsHacker(pair.get(0), pair.get(1), b.i("hackerVsHacker.uses"));
        }
        plan = EventScheduler.plan(b, rng, roundType.steal(), b.l("rounds.playMs"));
        planIdx = 0;
        freezeWarned.clear();

        for (PlayerState p : players.values()) {
            PlayerState t = players.get(p.target);
            Map<String, Object> duel = null;
            boolean spectator = false;
            if (rival != null) {
                if (rival.isDuelist(p.id)) duel = Json.obj("opponentId", rival.opponent(p.id), "opponentName", players.get(rival.opponent(p.id)).name);
                else spectator = true;
            }
            out.toPlayer(p.id, Json.msg("round_start", "round", round, "rounds", totalRounds(), "roundType", roundType.id(),
                    "banner", roundType.banner(), "speed", speed, "difficulty", difficulty,
                    "target", t == null ? null : Json.obj("id", t.id, "name", t.name),
                    "modifiers", modsWire(p.activeModifiers), "duel", duel, "spectator", spectator,
                    "hacker", hvh != null && hvh.hacker.equals(p.id), "team", p.team));
        }
        out.toHosts(Json.msg("narrate", "key", "round_intro", "vars", Json.obj("round", round, "type", roundType.id())));
        log.log(roomId, round, null, "round_start", Json.obj("type", roundType.id(), "speed", speed, "difficulty", difficulty,
                "bank", ledger.bank, "events", plan.size()));
    }

    private void startPlay(long now) {
        playStartedAt = now;
        for (PlayerState p : players.values()) {
            boolean plays = rival == null || rival.isDuelist(p.id);
            p.nextAssignAt = plays ? now : -1;
        }
        if (rival != null) {
            PlayerState a = players.get(rival.a), c = players.get(rival.b);
            out.toAll(Json.msg("rival_start", "a", Json.obj("id", a.id, "name", a.name), "b", Json.obj("id", c.id, "name", c.name),
                    "gameId", rival.gameId, "pot", Math.min(b.l("rival.pot"), ledger.bank)));
            out.toHosts(Json.msg("narrate", "key", "rival", "vars", Json.obj("a", a.name, "b", c.name)));
        }
        if (hvh != null) {
            PlayerState h = players.get(hvh.hacker), v = players.get(hvh.victim);
            out.toPlayer(h.id, Json.msg("hvh_power", "victimId", v.id, "victimName", v.name, "uses", hvh.usesLeft,
                    "scrambleMs", b.l("hackerVsHacker.scrambleMs")));
            out.toAll(Json.msg("hvh_start", "hackerName", h.name, "victimName", v.name));
            out.toHosts(Json.msg("narrate", "key", "hvh", "vars", Json.obj("hacker", h.name, "victim", v.name)));
            log.log(roomId, round, h.id, "hvh_start", Json.obj("victim", v.id));
        }
    }

    private void endPlay(long now) {
        if (steal != null) closeSteal(now);
        if (freezeEndsAt >= 0) endFreeze();
        if (raid != null) resolveRaid(now);
        for (PlayerState p : players.values()) {
            p.attempt = null;
            p.nextAssignAt = -1;
        }
    }

    private void finishRound(long now) {
        Map<String, Long> earnings = new LinkedHashMap<>();
        for (PlayerState p : players.values()) {
            long e = p.wallet - walletAtRoundStart.getOrDefault(p.id, 0L);
            p.roundEarnings = e;
            earnings.put(p.id, e);
        }
        List<String> bountyWinners = Targets.bountyWinners(targets, earnings);
        Map<String, Long> bountyPaid = new HashMap<>();
        for (String id : bountyWinners) {
            PlayerState p = players.get(id);
            if (p == null) continue;
            long paid = Economy.payout(ledger, p, b.l("bounty.bonus"));
            p.bounties++;
            bountyPaid.put(id, paid);
            log.log(roomId, round, id, "bounty", Json.obj("target", targets.get(id), "amount", paid, "wallet", p.wallet, "bank", ledger.bank));
        }
        Map<String, Long> teamDelta = Map.of();
        if (!teamOf.isEmpty()) {
            teamDelta = Teams.split(teamOf, earnings);
            for (var e : teamDelta.entrySet()) {
                PlayerState p = players.get(e.getKey());
                if (p == null) continue;
                if (e.getValue() >= 0) p.credit(e.getValue());
                else p.debit(-e.getValue());
            }
        }
        // Keys come home at round end (BE-07).
        for (PlayerState p : players.values()) {
            p.keyStolen = false;
            p.keyHeldBy = null;
        }
        List<Map<String, Object>> table = new ArrayList<>();
        for (PlayerState p : players.values()) {
            table.add(Json.obj("id", p.id, "name", p.name, "earned", earnings.get(p.id), "wallet", p.wallet, "stash", p.stash, "team", p.team));
        }
        for (PlayerState p : players.values()) {
            PlayerState t = players.get(targets.get(p.id));
            Map<String, Object> bounty = t == null ? null : Json.obj("targetId", t.id, "targetName", t.name,
                    "mine", earnings.get(p.id), "theirs", earnings.getOrDefault(t.id, 0L),
                    "won", bountyPaid.containsKey(p.id), "amount", bountyPaid.getOrDefault(p.id, 0L));
            out.toPlayer(p.id, Json.msg("round_results", "round", round, "table", table, "bank", ledger.bank,
                    "bounty", bounty, "teamDelta", teamDelta.get(p.id)));
        }
        out.toHosts(Json.msg("round_results", "round", round, "table", table, "bank", ledger.bank,
                "bounties", bountyWinners.size(), "bountyWinners", bountyWinners));
        log.log(roomId, round, null, "round_end", Json.obj("bank", ledger.bank, "earnings", earnings));
    }

    private void startBetween(long now) {
        votes.clear();
        for (PlayerState p : players.values()) {
            p.sabotageUsed = false;
            p.cardsPlayed = 0;
        }
        if (!teamOf.isEmpty()) {
            String[] swap = Teams.maybeSwap(b, rng, teamOf);
            if (swap != null) {
                teamOf.forEach((id, t) -> players.get(id).team = t);
                out.toAll(Json.msg("teams_update", "teams", teamOf, "swapped", List.of(swap[0], swap[1])));
                log.log(roomId, round, null, "team_swap", Json.obj("a", swap[0], "b", swap[1]));
            }
        }
        boolean sabotageOpen = round + 1 >= b.i("sabotage.fromRound");
        out.toAll(Json.msg("between", "nextRound", round + 1, "sabotage", sabotageOpen,
                "modifiers", sabotageOpen ? b.strings("sabotage.modifiers") : List.of(), "endsAt", phaseEndsAt));
    }

    private void startEscape(long now) {
        out.toAll(Json.msg("escape_open", "endsAt", phaseEndsAt, "bankEmpty", ledger.bankEmpty()));
        out.toHosts(Json.msg("narrate", "key", "escape", "vars", Json.obj()));
        log.log(roomId, round, null, "escape_open", Json.obj("bank", ledger.bank));
    }

    private void finishGame(long now) {
        for (PlayerState p : players.values()) {
            if (!p.escaped) {
                long lost = Economy.loseWallet(ledger, p);
                if (lost > 0) log.log(roomId, round, p.id, "wallet_lost", Json.obj("amount", lost));
            }
        }
        List<PlayerState> ranked = Endgame.standings(players.values());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            PlayerState p = ranked.get(i);
            rows.add(Json.obj("rank", i + 1, "id", p.id, "name", p.name, "stash", p.stash, "lost", p.lostAtEnd,
                    "escaped", p.escaped, "successes", p.successes, "fails", p.fails, "steals", p.steals,
                    "stolen", p.stolenAmount, "robbed", p.timesRobbed, "bounties", p.bounties, "team", p.team));
        }
        Map<String, Long> teamTotals = new LinkedHashMap<>();
        for (PlayerState p : ranked) if (p.team != null) teamTotals.merge(p.team, p.stash, Long::sum);
        String winningTeam = teamTotals.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
        PlayerState winner = ranked.isEmpty() ? null : ranked.get(0);
        finalStandings = Json.msg("final_standings", "winnerId", winner == null ? null : winner.id,
                "winnerName", winner == null ? null : winner.name, "standings", rows,
                "teams", teamTotals.isEmpty() ? null : teamTotals, "winningTeam", winningTeam, "bank", ledger.bank);
        out.toAll(finalStandings);
        if (winner != null) out.toHosts(Json.msg("narrate", "key", "winner", "vars", Json.obj("name", winner.name)));
        log.log(roomId, round, winner == null ? null : winner.id, "game_end", Json.obj("standings", rows, "bank", ledger.bank));
        onGameEnd.accept(this);
    }

    // ------------------------------------------------------------------ minigames

    private ModuleCatalog.Info pickGame(List<String> tags, boolean plainOnly) {
        List<ModuleCatalog.Info> allowed = new ArrayList<>();
        for (ModuleCatalog.Info g : catalog) {
            if (settings.games != null && !settings.games.contains(g.id())) continue;
            if (plainOnly && (g.hasTag("choice") || g.hasTag("push-luck"))) continue;
            allowed.add(g);
        }
        if (allowed.isEmpty()) return null;
        List<ModuleCatalog.Info> tagged = new ArrayList<>();
        for (ModuleCatalog.Info g : allowed) {
            for (String t : tags) if (g.hasTag(t)) {
                tagged.add(g);
                break;
            }
        }
        return rng.pick(tagged.isEmpty() ? allowed : tagged);
    }

    private ModuleCatalog.Info gameInfo(String id) {
        for (ModuleCatalog.Info g : catalog) if (g.id().equals(id)) return g;
        return null;
    }

    private void assign(PlayerState p, long now) {
        ModuleCatalog.Info g;
        long seed;
        boolean duel = rival != null && rival.isDuelist(p.id);
        if (duel) {
            if (rival.winner != null) {
                p.nextAssignAt = -1;
                return;
            }
            g = gameInfo(rival.gameId);
            seed = rival.nextSeed(p.id);
        } else {
            g = pickGame(roundType.tags(), false);
            seed = rng.seed();
        }
        if (g == null) {
            p.nextAssignAt = -1;
            return;
        }
        List<ModifierSpec> mods = now - playStartedAt < b.l("sabotage.activeForFirstMs") ? p.activeModifiers : List.of();
        p.attempt = new Attempt("a" + (++seq), g.id(), difficulty, speed, seed, now, List.copyOf(mods), duel);
        sendAssign(p);
    }

    private void sendAssign(PlayerState p) {
        Attempt a = p.attempt;
        ModuleCatalog.Info g = gameInfo(a.gameId());
        out.toPlayer(p.id, Json.msg("minigame_assign", "attemptId", a.id(), "gameId", a.gameId(), "file", g == null ? null : g.file(),
                "name", g == null ? a.gameId() : g.name(), "difficulty", a.difficulty(), "speed", a.speed(), "seed", a.seed(),
                "modifiers", modsWire(a.modifiers()), "duel", a.duel() ? true : null));
    }

    private static List<Map<String, Object>> modsWire(List<ModifierSpec> mods) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (ModifierSpec m : mods) out.add(Json.obj("id", m.id(), "durationMs", m.durationMs(), "strength", m.strength()));
        return out;
    }

    private void onResult(PlayerState p, JsonNode msg, long now) {
        if (phase != Phase.PLAY) throw new GameError("wrong_phase", "Round is over");
        Attempt a = p.attempt;
        String attemptId = Json.str(msg, "attemptId", "");
        if (a == null || !a.id().equals(attemptId)) throw new GameError("stale_attempt", "Unknown attempt");
        p.attempt = null;
        p.nextAssignAt = now + b.l("minigame.nextAssignDelayMs");
        if (now - a.issuedAt() < b.l("minigame.minSolveMs")) {
            out.toPlayer(p.id, Json.msg("minigame_ack", "attemptId", a.id(), "accepted", false, "reason", "too_fast"));
            log.log(roomId, round, p.id, "minigame_rejected", Json.obj("game", a.gameId(), "ms", now - a.issuedAt()));
            return;
        }
        boolean success = Json.bool(msg, "success", false);
        ModuleCatalog.Info g = gameInfo(a.gameId());
        boolean choice = g != null && g.hasTag("choice");
        boolean pushLuck = g != null && g.hasTag("push-luck");
        String tierId = msg.path("wager").path("tier").asText(null);
        Wager.Tier tier = Wager.NONE;
        if (choice) tier = Wager.tier(b, tierId);
        // Only push-your-luck games (and the double-safe average of one) may scale the payout.
        double score = pushLuck ? Json.dbl(msg, "scoreMultiplier", 1.0) : 1.0;
        if (Double.isNaN(score)) score = 1.0;
        score = Math.max(b.d("payout.minScoreMultiplier"), Math.min(b.d("payout.maxScoreMultiplier"), score));

        long delta;
        if (success) {
            long base = b.ints("payout.byDifficulty").get(a.difficulty() - 1);
            long want = Economy.successAmount(base, roundType.payoutMult(), score, tier.payoutMult());
            delta = Economy.payout(ledger, p, want);
            // PR-02: optional calm bonus when the Presage heart-rate module reports the player kept their cool.
            if (msg.path("nerves").path("calm").asBoolean(false) && b.strings("presage.games").contains(a.gameId())) {
                delta += Economy.payout(ledger, p, b.l("presage.calmBonus"));
            }
            p.successes++;
            p.streak++;
            p.bestStreak = Math.max(p.bestStreak, p.streak);
            out.toHosts(Json.msg("fx", "kind", "success", "playerId", p.id, "name", p.name, "gameId", a.gameId(), "amount", delta));
        } else {
            double mult = tier.failPenaltyMult() * (pushLuck ? b.d("minigame.pushLuckFailPenaltyMult") : 1.0);
            delta = -Economy.penalty(ledger, p, Math.round(b.l("fail.walletPenalty") * mult));
            p.fails++;
            p.streak = 0;
            String reason = Json.str(msg, "reason", "fail");
            out.toHosts(Json.msg("fx", "kind", "fail", "playerId", p.id, "name", p.name, "gameId", a.gameId(), "reason", reason, "amount", delta));
            if (rng.chance(0.35)) out.toHosts(Json.msg("narrate", "key", "fail", "vars", Json.obj("name", p.name)));
            if (hvh != null && hvh.victim.equals(p.id) && now <= p.jammedUntil + 500) {
                PlayerState h = players.get(hvh.hacker);
                if (h != null) {
                    long bonus = Economy.payout(ledger, h, b.l("hackerVsHacker.bonusPerVictimFail"));
                    out.toPlayer(h.id, Json.msg("hvh_bonus", "amount", bonus));
                    log.log(roomId, round, h.id, "hvh_bonus", Json.obj("amount", bonus, "wallet", h.wallet, "bank", ledger.bank));
                }
            }
        }
        out.toPlayer(p.id, Json.msg("minigame_ack", "attemptId", a.id(), "accepted", true, "success", success, "delta", delta, "wallet", p.wallet));
        log.log(roomId, round, p.id, "minigame_result", Json.obj("game", a.gameId(), "success", success, "delta", delta,
                "tier", tier == Wager.NONE ? null : tier.id(), "score", score,
                "ms", now - a.issuedAt(), "wallet", p.wallet, "bank", ledger.bank));
        if (success && delta > 0) log.log(roomId, round, p.id, "bank_draw", Json.obj("amount", delta, "bank", ledger.bank));

        if (a.duel() && rival != null && success && rival.claim(p.id)) resolveDuel(p, now);
        afterBankChange(now);
        dirty = true;
    }

    private void resolveDuel(PlayerState winner, long now) {
        PlayerState loser = players.get(rival.opponent(winner.id));
        long pot = Math.min(b.l("rival.pot"), ledger.bank);
        long won = Economy.payout(ledger, winner, Math.round(pot * b.d("rival.winnerShare")));
        long pen = loser == null ? 0 : Economy.penalty(ledger, loser, b.l("rival.loserPenalty"));
        out.toAll(Json.msg("rival_result", "winnerId", winner.id, "winnerName", winner.name,
                "loserId", loser == null ? null : loser.id, "loserName", loser == null ? null : loser.name, "amount", won, "penalty", pen));
        out.toHosts(Json.msg("narrate", "key", "rival_win", "vars", Json.obj("name", winner.name)));
        log.log(roomId, round, winner.id, "rival_win", Json.obj("loser", loser == null ? null : loser.id, "amount", won, "penalty", pen,
                "wallet", winner.wallet, "bank", ledger.bank));
        for (PlayerState p : players.values()) {
            p.nextAssignAt = -1;
            p.attempt = null;
        }
        phaseEndsAt = Math.min(phaseEndsAt, now + 1500);
    }

    private void afterBankChange(long now) {
        if (ledger.bankStart <= 0) return;
        double frac = (double) ledger.bank / ledger.bankStart;
        for (double f : b.doubles("bank.warnAtFractions")) {
            if (frac <= f && warned.add(f)) {
                out.toAll(Json.msg("bank_warning", "pct", (int) Math.round(f * 100), "bank", ledger.bank));
                out.toHosts(Json.msg("narrate", "key", "bank_" + (int) Math.round(f * 100), "vars", Json.obj()));
            }
        }
        if (ledger.bankEmpty() && !bankZeroAnnounced) {
            bankZeroAnnounced = true;
            out.toAll(Json.msg("bank_warning", "pct", 0, "bank", 0));
            out.toHosts(Json.msg("narrate", "key", "bank_0", "vars", Json.obj()));
            log.log(roomId, round, null, "bank_empty", Json.obj());
            if (phase == Phase.PLAY) phaseEndsAt = now;
        }
    }

    // ------------------------------------------------------------------ timed events

    private void openEvent(EventScheduler.Kind kind, long now, long dur) {
        switch (kind) {
            case STEAL -> {
                if (steal != null) closeSteal(now);
                steal = new StealArbiter(now, now + dur);
                out.toAll(Json.msg("steal_open", "endsAt", now + dur, "now", now));
                out.toHosts(Json.msg("narrate", "key", "steal", "vars", Json.obj()));
                log.log(roomId, round, null, "steal_open", Json.obj("ms", dur));
            }
            case FREEZE -> {
                freezeStart = now;
                freezeEndsAt = now + dur;
                freezeViolators.clear();
                // v2: a Freeze pauses the round for everyone. Push the round end and every later event back.
                if (phase == Phase.PLAY) {
                    phaseEndsAt += dur;
                    playStartedAt += dur;
                }
                out.toAll(Json.msg("freeze_start", "endsAt", freezeEndsAt, "now", now, "roundEndsAt", phaseEndsAt));
                out.toHosts(Json.msg("narrate", "key", "freeze", "vars", Json.obj()));
                log.log(roomId, round, null, "freeze_start", Json.obj("ms", dur));
            }
            case BANKRAID -> {
                if (raid != null) resolveRaid(now);
                raid = new BankRaid(now + dur, b.i("bankRaid.winners"));
                out.toAll(Json.msg("bankraid_open", "endsAt", now + dur, "now", now, "winners", raid.maxWinners,
                        "bonus", Math.min(b.l("bankRaid.bonusTotal"), ledger.bank)));
                out.toHosts(Json.msg("narrate", "key", "bankraid", "vars", Json.obj()));
                log.log(roomId, round, null, "bankraid_open", Json.obj("ms", dur));
            }
        }
        dirty = true;
    }

    private void closeExpiredWindows(long now) {
        if (steal != null && now >= steal.closesAt()) closeSteal(now);
        if (freezeEndsAt >= 0 && now >= freezeEndsAt + b.l("freeze.graceMs")) endFreeze();
        if (raid != null && now >= raid.endsAt) resolveRaid(now);
    }

    private void closeSteal(long now) {
        out.toAll(Json.msg("steal_closed", "winnerId", steal.winner()));
        steal = null;
        dirty = true;
    }

    private void endFreeze() {
        out.toAll(Json.msg("freeze_end"));
        freezeStart = -1;
        freezeEndsAt = -1;
        dirty = true;
    }

    private void resolveRaid(long now) {
        BankRaid r = raid;
        raid = null;
        long each = BankRaid.share(b.l("bankRaid.bonusTotal"), r.grabbers.size());
        List<Map<String, Object>> winners = new ArrayList<>();
        for (String id : r.grabbers) {
            PlayerState p = players.get(id);
            if (p == null) continue;
            long paid = Economy.payout(ledger, p, each);
            winners.add(Json.obj("id", id, "name", p.name, "amount", paid));
            log.log(roomId, round, id, "bankraid_win", Json.obj("amount", paid, "wallet", p.wallet, "bank", ledger.bank));
        }
        out.toAll(Json.msg("bankraid_result", "winners", winners));
        afterBankChange(now);
        dirty = true;
    }

    private void onScan(PlayerState p, JsonNode msg, long now) {
        if (steal == null) {
            out.toPlayer(p.id, Json.msg("steal_reject", "reason", "no_window"));
            return;
        }
        PlayerState victim = null;
        String code = Json.str(msg, "code", null);
        if (code != null) {
            int n = signer.verify(code);
            for (PlayerState o : players.values()) if (n > 0 && o.vaultNo == n) victim = o;
        } else {
            PlayerState v = players.get(Json.str(msg, "victim", ""));
            if (v != null && (settings.virtualKeys || v.bot)) victim = v;
        }
        StealArbiter.Outcome o = steal.scan(p, victim, now);
        if (!o.won()) {
            out.toPlayer(p.id, Json.msg("steal_reject", "reason", o.reject().name().toLowerCase()));
            return;
        }
        long amount = 0;
        boolean blocked = victim.shield;
        if (blocked) {
            victim.shield = false;
        } else {
            amount = Economy.transfer(victim, p, Economy.stealAmount(victim.wallet, b.d("steal.pctOfVictimWallet"),
                    b.l("steal.minAmount"), p.stealBoost));
            p.stealBoost = 0;
            if (b.l("steal.thiefBonus") > 0) amount += Economy.payout(ledger, p, b.l("steal.thiefBonus"));
        }
        victim.keyStolen = true;
        victim.keyHeldBy = p.id;
        p.steals++;
        p.stolenAmount += amount;
        victim.timesRobbed++;
        victim.lostToThieves += amount;
        out.toAll(Json.msg("steal_result", "thiefId", p.id, "thiefName", p.name, "victimId", victim.id, "victimName", victim.name,
                "amount", amount, "blocked", blocked));
        out.toHosts(Json.msg("narrate", "key", blocked ? "steal_blocked" : "steal_success", "vars", Json.obj("thief", p.name, "victim", victim.name)));
        log.log(roomId, round, p.id, "steal", Json.obj("victim", victim.id, "amount", amount, "blocked", blocked,
                "wallet", p.wallet, "victimWallet", victim.wallet, "bank", ledger.bank));
        closeSteal(now);
        dirty = true;
    }

    private void onFreezeViolation(PlayerState p, long now) {
        if (freezeStart < 0 || now < freezeStart || now > freezeEndsAt + b.l("freeze.graceMs")) return;
        if (!freezeViolators.add(p.id)) return;
        long taken = Economy.penalty(ledger, p, b.l("freeze.violationPenalty"));
        p.freezeViolations++;
        out.toPlayer(p.id, Json.msg("freeze_penalty", "amount", taken, "wallet", p.wallet));
        out.toHosts(Json.msg("fx", "kind", "freeze_violation", "playerId", p.id, "name", p.name, "amount", -taken));
        log.log(roomId, round, p.id, "freeze_violation", Json.obj("amount", taken, "wallet", p.wallet, "bank", ledger.bank));
        dirty = true;
    }

    // ------------------------------------------------------------------ intents

    /** Handle one player intent. Throws GameError for rejected intents. */
    public void handle(String pid, JsonNode msg, long now) {
        PlayerState p = player(pid);
        String t = Json.str(msg, "t", "");
        switch (t) {
            case "key_claim" -> {
                if (phase != Phase.LOBBY) throw new GameError("wrong_phase", "Claim keys in the lobby");
                claimKey(pid, Json.str(msg, "code", ""));
            }
            case "key_scan" -> onScan(p, msg, now);
            case "minigame_result" -> onResult(p, msg, now);
            case "freeze_violation" -> onFreezeViolation(p, now);
            case "bankraid_grab" -> onGrab(p, now);
            case "escape" -> onEscape(p, now);
            case "sabotage" -> onSabotage(p, msg);
            case "hack_scramble" -> onScramble(p, now);
            case "card_play" -> onCardPlay(p, msg, now);
            case "card_vote" -> onCardVote(p, msg, now);
            case "card_optout" -> onCardOptOut(p, msg, now);
            default -> throw new GameError("unknown_intent", "Unknown message " + t);
        }
    }

    private void onGrab(PlayerState p, long now) {
        if (raid == null) {
            out.toPlayer(p.id, Json.msg("bankraid_ack", "position", -1));
            return;
        }
        int pos = raid.grab(p.id, now);
        out.toPlayer(p.id, Json.msg("bankraid_ack", "position", pos));
        if (raid.full()) resolveRaid(now);
    }

    private void onEscape(PlayerState p, long now) {
        if (phase != Phase.ESCAPE || now > phaseEndsAt + b.l("escape.lateGraceMs")) throw new GameError("wrong_phase", "Not escape time");
        if (p.escaped) return;
        long banked = Economy.bankWallet(p);
        p.escaped = true;
        p.escapedAt = now;
        out.toPlayer(p.id, Json.msg("escape_ack", "banked", banked, "stash", p.stash));
        out.toHosts(Json.msg("fx", "kind", "escape", "playerId", p.id, "name", p.name, "amount", banked));
        log.log(roomId, round, p.id, "escape", Json.obj("banked", banked, "stash", p.stash, "wallet", 0));
        if (players.values().stream().allMatch(x -> x.escaped || !x.connected)) phaseEndsAt = now;
        dirty = true;
    }

    private void onSabotage(PlayerState p, JsonNode msg) {
        PlayerState target = players.get(Json.str(msg, "targetId", ""));
        String mod = Json.str(msg, "modifier", "");
        ModifierSpec spec = Sabotage.validate(b, phase, round + 1, p, target, mod, players);
        target.pendingModifiers.add(spec);
        p.sabotageUsed = true;
        out.toPlayer(p.id, Json.msg("sabotage_ack", "targetId", target.id, "targetName", target.name, "modifier", mod));
        out.toHosts(Json.msg("fx", "kind", "sabotage", "modifier", mod));
        log.log(roomId, round, p.id, "sabotage", Json.obj("target", target.id, "modifier", mod));
    }

    private void onScramble(PlayerState p, long now) {
        if (phase != Phase.PLAY || hvh == null || !hvh.use(p.id)) throw new GameError("no_power", "You have no scrambles");
        PlayerState v = players.get(hvh.victim);
        long ms = b.l("hackerVsHacker.scrambleMs");
        v.jammedUntil = now + ms;
        out.toPlayer(v.id, Json.msg("modifier_apply", "id", "jam-the-signal", "durationMs", ms, "strength", b.d("hackerVsHacker.scrambleStrength")));
        out.toPlayer(p.id, Json.msg("hvh_ack", "usesLeft", hvh.usesLeft));
        out.toHosts(Json.msg("narrate", "key", "hvh_scramble", "vars", Json.obj("hacker", p.name, "victim", v.name)));
        log.log(roomId, round, p.id, "hvh_scramble", Json.obj("victim", v.id));
    }

    private void onCardPlay(PlayerState p, JsonNode msg, long now) {
        if (phase != Phase.BETWEEN) throw new GameError("wrong_phase", "Cards are played between rounds");
        if (p.cardsPlayed >= b.i("cards.maxPerPlayerPerBetween")) throw new GameError("card_limit", "One card per break");
        Content.Card card = content.cards.get((int) Json.lng(msg, "number", -1));
        if (card == null) throw new GameError("bad_card", "No card with that number");
        p.cardsPlayed++;
        Cards.Vote v = new Cards.Vote("v" + (++seq), card, p.id, now + b.l("cards.voteMs"));
        votes.put(v.id, v);
        out.toAll(Json.msg("card_vote_open", "voteId", v.id, "playerId", p.id, "playerName", p.name, "endsAt", v.endsAt,
                "card", Json.obj("number", card.number(), "type", card.type(), "title", card.title(), "text", card.text(), "physical", card.physical())));
        log.log(roomId, round, p.id, "card_play", Json.obj("card", card.number()));
        if (eligibleVoters(v) == 0) resolveVote(v, false, now);
    }

    private long eligibleVoters(Cards.Vote v) {
        return players.values().stream().filter(x -> !x.id.equals(v.playerId) && x.connected).count();
    }

    private void onCardVote(PlayerState p, JsonNode msg, long now) {
        Cards.Vote v = votes.get(Json.str(msg, "voteId", ""));
        if (v == null) throw new GameError("bad_vote", "Vote is closed");
        if (v.playerId.equals(p.id)) throw new GameError("bad_vote", "You cannot vote on your own card");
        v.ballots.putIfAbsent(p.id, Json.bool(msg, "pass", true));
        if (v.ballots.size() >= eligibleVoters(v)) resolveVote(v, false, now);
    }

    private void onCardOptOut(PlayerState p, JsonNode msg, long now) {
        Cards.Vote v = votes.get(Json.str(msg, "voteId", ""));
        if (v == null || !v.playerId.equals(p.id)) throw new GameError("bad_vote", "Not your card");
        resolveVote(v, true, now);
    }

    private void resolveVote(Cards.Vote v, boolean optOut, long now) {
        if (votes.remove(v.id) == null) return;
        PlayerState p = players.get(v.playerId);
        if (p == null) return;
        boolean passed = v.passed();
        Cards.Effect e = Cards.apply(b, ledger, p, v.card, passed, optOut);
        out.toAll(Json.msg("card_vote_result", "voteId", v.id, "playerId", p.id, "playerName", p.name, "passed", passed,
                "optOut", optOut, "delta", e.delta(), "note", e.note(), "card", v.card.number()));
        log.log(roomId, round, p.id, "card", Json.obj("card", v.card.number(), "passed", passed, "optOut", optOut,
                "delta", e.delta(), "wallet", p.wallet, "bank", ledger.bank));
        afterBankChange(now);
        dirty = true;
    }

    // ------------------------------------------------------------------ admin (TL-02)

    public void admin(JsonNode msg, long now) {
        String action = Json.str(msg, "action", "");
        switch (action) {
            case "force_steal" -> forceEvent(EventScheduler.Kind.STEAL, now);
            case "force_freeze" -> forceEvent(EventScheduler.Kind.FREEZE, now);
            case "force_bankraid" -> forceEvent(EventScheduler.Kind.BANKRAID, now);
            case "skip_round" -> {
                if (phase == Phase.LOBBY || phase == Phase.END) throw new GameError("wrong_phase", "Nothing to skip");
                phaseEndsAt = now;
                tick(now);
            }
            case "set_bank" -> {
                requireGame();
                long amount = Math.max(0, Json.lng(msg, "amount", ledger.bank));
                ledger.bankStart += amount - ledger.bank;
                ledger.bank = amount;
                afterBankChange(now);
            }
            case "grant" -> {
                requireGame();
                PlayerState p = player(Json.str(msg, "playerId", ""));
                long amount = Json.lng(msg, "amount", 0);
                if (amount >= 0) Economy.payout(ledger, p, amount);
                else Economy.penalty(ledger, p, -amount);
                afterBankChange(now);
            }
            case "kick" -> kick(Json.str(msg, "playerId", ""));
            case "end_game" -> {
                if (phase == Phase.LOBBY || phase == Phase.END) throw new GameError("wrong_phase", "No game running");
                enter(Phase.END, round, now);
            }
            default -> throw new GameError("unknown_admin", "Unknown admin action " + action);
        }
        log.log(roomId, round, null, "admin", Json.obj("action", action));
        dirty = true;
    }

    private void requireGame() {
        if (ledger == null) throw new GameError("wrong_phase", "No game running");
    }

    private void forceEvent(EventScheduler.Kind k, long now) {
        if (phase != Phase.PLAY) throw new GameError("wrong_phase", "Events only fire during play");
        openEvent(k, now, EventScheduler.duration(b, k));
    }

    public void kick(String pid) {
        PlayerState p = players.remove(pid);
        if (p == null) throw new GameError("no_player", "Unknown player");
        if (ledger != null) ledger.burned += p.wallet + p.stash;
        teamOf.remove(pid);
        out.toPlayer(pid, Json.msg("kicked"));
        log.log(roomId, round, pid, "kick", Json.obj());
        dirty = true;
    }

    // ------------------------------------------------------------------ state

    private PlayerState player(String pid) {
        PlayerState p = players.get(pid);
        if (p == null) throw new GameError("no_player", "Unknown player");
        return p;
    }

    private Map<String, Object> activeEvent(long now) {
        if (steal != null && steal.isOpen(now)) return Json.obj("type", "steal", "endsAt", steal.closesAt());
        if (freezeEndsAt >= 0) return Json.obj("type", "freeze", "endsAt", freezeEndsAt);
        if (raid != null) return Json.obj("type", "bankraid", "endsAt", raid.endsAt);
        return null;
    }

    /** The public part of the state message (identical for everybody). */
    public Map<String, Object> publicState(long now) {
        List<Map<String, Object>> ps = new ArrayList<>();
        for (PlayerState p : players.values()) {
            ps.add(Json.obj("id", p.id, "name", p.name, "wallet", p.wallet, "stash", p.stash, "on", p.connected ? 1 : 0,
                    "key", p.keyCode == null ? "none" : p.keyStolen ? "stolen" : "held", "vault", p.vaultNo,
                    "team", p.team, "esc", p.escaped ? 1 : null, "bot", p.bot ? 1 : null));
        }
        return Json.msg("state", "room", roomId, "phase", phase.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "endsAt", phaseEndsAt, "now", now,
                "bank", ledger == null ? null : ledger.bank, "bankStart", ledger == null ? null : ledger.bankStart,
                "speed", speed, "event", activeEvent(now), "players", ps);
    }

    private void broadcastState(long now) {
        Map<String, Object> pub = publicState(now);
        out.toHosts(pub);
        for (PlayerState p : players.values()) {
            if (!p.connected) continue;
            Map<String, Object> m = new LinkedHashMap<>(pub);
            m.put("me", meWire(p));
            out.toPlayer(p.id, m);
        }
        dirty = false;
        lastStateAt = now;
    }

    private Map<String, Object> meWire(PlayerState p) {
        PlayerState t = p.target == null ? null : players.get(p.target);
        return Json.obj("id", p.id, "vaultName", p.vaultName, "target", t == null ? null : Json.obj("id", t.id, "name", t.name),
                "shield", p.shield ? 1 : null, "boost", p.stealBoost > 0 ? p.stealBoost : null, "team", p.team);
    }

    /** Re-send everything a reconnecting phone needs to land back in the current phase (BE-02). */
    public void resync(String pid, long now) {
        PlayerState p = player(pid);
        Map<String, Object> m = new LinkedHashMap<>(publicState(now));
        m.put("me", meWire(p));
        out.toPlayer(pid, Json.msg("phase_changed", "phase", phase.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "banner", roundType == null ? null : roundType.banner(),
                "endsAt", phaseEndsAt, "now", now, "resync", true));
        out.toPlayer(pid, m);
        if (phase == Phase.BETWEEN) {
            boolean sabotageOpen = round + 1 >= b.i("sabotage.fromRound");
            out.toPlayer(pid, Json.msg("between", "nextRound", round + 1, "sabotage", sabotageOpen && !p.sabotageUsed,
                    "modifiers", sabotageOpen ? b.strings("sabotage.modifiers") : List.of(), "endsAt", phaseEndsAt));
            for (Cards.Vote v : votes.values()) {
                PlayerState owner = players.get(v.playerId);
                out.toPlayer(pid, Json.msg("card_vote_open", "voteId", v.id, "playerId", v.playerId, "playerName", owner == null ? "?" : owner.name,
                        "endsAt", v.endsAt, "card", Json.obj("number", v.card.number(), "type", v.card.type(), "title", v.card.title(),
                                "text", v.card.text(), "physical", v.card.physical())));
            }
        }
        if (phase == Phase.PLAY && p.attempt != null) sendAssign(p);
        if (phase == Phase.PLAY && p.attempt == null && p.nextAssignAt < 0 && (rival == null || rival.isDuelist(p.id)) && (rival == null || rival.winner == null)) {
            p.nextAssignAt = now;
        }
        if (steal != null && steal.isOpen(now)) out.toPlayer(pid, Json.msg("steal_open", "endsAt", steal.closesAt(), "now", now));
        if (freezeEndsAt >= 0) out.toPlayer(pid, Json.msg("freeze_start", "endsAt", freezeEndsAt, "now", now));
        if (raid != null) out.toPlayer(pid, Json.msg("bankraid_open", "endsAt", raid.endsAt, "now", now, "winners", raid.maxWinners));
        if (hvh != null && hvh.hacker.equals(pid) && phase == Phase.PLAY) {
            PlayerState v = players.get(hvh.victim);
            out.toPlayer(pid, Json.msg("hvh_power", "victimId", v.id, "victimName", v.name, "uses", hvh.usesLeft,
                    "scrambleMs", b.l("hackerVsHacker.scrambleMs")));
        }
        if (phase == Phase.ESCAPE && !p.escaped) out.toPlayer(pid, Json.msg("escape_open", "endsAt", phaseEndsAt));
        if (phase == Phase.END && finalStandings != null) out.toPlayer(pid, finalStandings);
    }

    /** Snapshot for a (re)connecting host screen. */
    public void resyncHost(java.util.function.Consumer<Map<String, Object>> send, long now) {
        send.accept(Json.msg("phase_changed", "phase", phase.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "banner", roundType == null ? null : roundType.banner(),
                "endsAt", phaseEndsAt, "now", now, "resync", true));
        send.accept(publicState(now));
        if (phase == Phase.END && finalStandings != null) send.accept(finalStandings);
    }

    /** Returns a description of the first broken money invariant, or null if all hold. */
    public String invariantError() {
        if (ledger == null) return null;
        if (ledger.bank < 0) return "bank negative: " + ledger.bank;
        long sum = ledger.bank + ledger.burned;
        for (PlayerState p : players.values()) {
            if (p.wallet < 0) return p.name + " wallet negative";
            if (p.stash < 0) return p.name + " stash negative";
            sum += p.wallet + p.stash;
        }
        return sum == ledger.bankStart ? null : "money not conserved: " + sum + " != " + ledger.bankStart;
    }

    // ------------------------------------------------------------------ accessors

    public String roomId() {
        return roomId;
    }

    public Phase phase() {
        return phase;
    }

    public int round() {
        return round;
    }

    public long phaseEndsAt() {
        return phaseEndsAt;
    }

    public Economy.Ledger ledger() {
        return ledger;
    }

    public Map<String, PlayerState> players() {
        return players;
    }

    public RoundTypes.RoundType roundType() {
        return roundType;
    }

    public double speed() {
        return speed;
    }

    public Map<String, String> targets() {
        return targets;
    }

    public List<EventScheduler.Scheduled> plan() {
        return plan;
    }

    public RivalHeist rival() {
        return rival;
    }

    public HackerVsHacker hvh() {
        return hvh;
    }

    public Map<String, Object> finalStandings() {
        return finalStandings;
    }

    public Map<String, Cards.Vote> votes() {
        return votes;
    }

    public boolean stealOpen(long now) {
        return steal != null && steal.isOpen(now);
    }

    public void openForTest(EventScheduler.Kind k, long now) {
        openEvent(k, now, EventScheduler.duration(b, k));
    }

    public Balance balance() {
        return b;
    }
}
