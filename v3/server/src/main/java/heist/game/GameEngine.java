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
    private long freezeStart = -1;
    private long freezeEndsAt = -1;
    private final Set<String> freezeViolators = new HashSet<>();
    // v3 rival duels: the live duels, who is paired with whom (rival round or rival event), and the event window.
    private final Map<String, Duel> duels = new LinkedHashMap<>();
    private Map<String, String> rivalOf = new HashMap<>();
    private boolean rivalRound;
    private final Map<String, Long> nextDuelAt = new HashMap<>();
    private final Map<String, Integer> duelWins = new HashMap<>();
    private long rivalEventEndsAt = -1;
    private long rivalEventClosesAt = -1;
    private HackerVsHacker hvh;
    private Map<String, String> targets = new HashMap<>();
    private Map<String, String> teamOf = new LinkedHashMap<>();
    private final Map<String, Long> walletAtRoundStart = new HashMap<>();
    /** v2: this round's payout multiplier so the bank drains over the chosen rounds (Economy.roundScale). */
    private double payoutScale = 1.0;
    /** v2: paid jobs per player last regular round, so the scale learns how fast this crew actually earns. */
    private double paidJobsPerPlayer = -1;
    private int roundSuccesses;

    // Between phase
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
        p.face = freeFace();
        players.put(p.id, p);
        log.log(roomId, 0, p.id, "join", Json.obj("name", name, "bot", bot));
        dirty = true;
        return p;
    }

    static String cleanName(String raw) {
        if (raw == null) return "";
        String n = raw.replaceAll("[\\p{Cntrl}<>]", "").trim();
        return n.length() > 16 ? n.substring(0, 16) : n;
    }

    /** v2: every player gets a random animal face nobody else in the room has (repeats only past the list). */
    private String freeFace() {
        Set<String> used = new HashSet<>();
        players.values().forEach(x -> used.add(x.face));
        List<String> free = new ArrayList<>();
        for (String f : content.animalFaces) if (!used.contains(f)) free.add(f);
        return rng.pick(free.isEmpty() ? content.animalFaces : free);
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
        if (settings.teams) {
            teamOf = Teams.form(b, rng, new ArrayList<>(players.keySet()), content);
            teamOf.forEach((id, t) -> players.get(id).team = t);
        }
        ledger = new Economy.Ledger(Economy.startingBank(b.l("bank.startPerPlayer"), players.size(), b.d("bank.crewExponent")));
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
            tickDuels(now);
            if (rivalEventEndsAt < 0) { // jobs are on hold while a rival event runs
                for (PlayerState p : players.values()) {
                    if (p.attempt == null && p.nextAssignAt >= 0 && now >= p.nextAssignAt && p.connected) assign(p, now);
                }
            }
        }
        if (phaseEndsAt >= 0 && now >= phaseEndsAt && phase != Phase.LOBBY && phase != Phase.END) advance(now);
        long minGap = 1000L / Math.max(1, b.i("net.maxStateHz"));
        if (dirty && (lastStateAt < 0 || now - lastStateAt >= minGap)) broadcastState(now);
    }

    private void advance(long now) {
        RoundMachine.Step s = RoundMachine.next(phase, round, totalRounds() + b.i("economy.overtimeMaxRounds"), ledger != null && ledger.bankEmpty());
        enter(s.phase(), s.round(), now);
    }

    public int totalRounds() {
        return settings.rounds > 0 ? settings.rounds : b.i("rounds.count");
    }

    /** v2: rounds past the host's count run as overtime until the bank is empty. 0 = regular round. */
    public int overtime() {
        return Math.max(0, round - totalRounds());
    }

    private void enter(Phase next, int r, long now) {
        // Leaving a phase
        if (phase == Phase.PLAY) endPlay(now);
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
                "endsAt", phaseEndsAt, "now", now, "overtime", overtime()));
        switch (next) {
            case BRIEFING -> setupRound(now);
            case PLAY -> startPlay(now);
            case RESULTS -> finishRound(now);
            case BETWEEN -> startBetween(now);
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
            p.jammedUntil = -1;
            p.activeModifiers = new ArrayList<>(p.pendingModifiers);
            p.pendingModifiers.clear();
            walletAtRoundStart.put(p.id, p.wallet);
        }
        targets = Targets.assign(rng, ids, teamOf);
        players.values().forEach(p -> p.target = targets.get(p.id));

        // v3: a rival round pairs EVERY player (the round type is only chosen with an even player count).
        duels.clear();
        nextDuelAt.clear();
        duelWins.clear();
        rivalRound = "rival".equals(roundType.id()) && ids.size() >= 2 && ids.size() % 2 == 0;
        rivalOf = rivalRound ? pairUp(ids) : new HashMap<>();
        hvh = null;
        if (b.ints("hackerVsHacker.rounds").contains(round) && ids.size() >= 2) {
            List<String> pair = rng.shuffled(ids).subList(0, 2);
            hvh = new HackerVsHacker(pair.get(0), pair.get(1), b.i("hackerVsHacker.uses"));
        }
        long base = b.ints("payout.byDifficulty").get(difficulty - 1);
        double jobs = paidJobsPerPlayer > 0 ? Math.max(1.0, paidJobsPerPlayer) : b.d("economy.expectedPaidJobsPerPlayer");
        int earners = players.size();
        payoutScale = Economy.roundScale(ledger.bank, totalRounds() - round + 1, overtime(), earners, base, roundType.payoutMult(),
                jobs, b.d("economy.scaleMin"), b.d("economy.scaleMax"), b.d("economy.overtimeBoostPerRound"));
        roundSuccesses = 0;
        // Rival rounds are all duels (no events); other rounds may get a rival event when the crew can be paired.
        plan = rivalRound ? List.of() : EventScheduler.plan(b, rng, b.l("rounds.playMs"), rivalEventAllowed());
        planIdx = 0;
        freezeWarned.clear();

        for (PlayerState p : players.values()) {
            PlayerState t = players.get(p.target);
            Map<String, Object> duel = null;
            boolean spectator = false;
            PlayerState opp = rivalRound ? players.get(rivalOf.get(p.id)) : null;
            if (opp != null) duel = Json.obj("opponentId", opp.id, "opponentName", opp.name, "opponentFace", opp.face);
            out.toPlayer(p.id, Json.msg("round_start", "round", round, "rounds", totalRounds(), "roundType", roundType.id(),
                    "banner", roundType.banner(), "speed", speed, "difficulty", difficulty,
                    "target", t == null ? null : Json.obj("id", t.id, "name", t.name, "face", t.face),
                    "modifiers", modsWire(p.activeModifiers), "duel", duel, "spectator", spectator,
                    "hacker", hvh != null && hvh.hacker.equals(p.id), "team", p.team,
                    "payoutScale", payoutScale, "overtime", overtime()));
        }
        out.toHosts(Json.msg("narrate", "key", "round_intro", "vars", Json.obj("round", round, "type", roundType.id())));
        log.log(roomId, round, null, "round_start", Json.obj("type", roundType.id(), "speed", speed, "difficulty", difficulty,
                "bank", ledger.bank, "events", plan.size(), "payoutScale", payoutScale));
    }

    private void startPlay(long now) {
        playStartedAt = now;
        for (PlayerState p : players.values()) p.nextAssignAt = rivalRound ? -1 : now;
        if (rivalRound) {
            out.toHosts(Json.msg("rival_round", "pairs", pairsWire()));
            out.toHosts(Json.msg("narrate", "key", "rival", "vars", Json.obj()));
            for (String a : rivalOf.keySet()) if (a.compareTo(rivalOf.get(a)) < 0) nextDuelAt.put(a, now + 600);
        }
        if (hvh != null) {
            PlayerState h = players.get(hvh.hacker), v = players.get(hvh.victim);
            out.toPlayer(h.id, Json.msg("hvh_power", "victimId", v.id, "victimName", v.name, "victimFace", v.face, "uses", hvh.usesLeft,
                    "scrambleMs", b.l("hackerVsHacker.scrambleMs")));
            out.toAll(Json.msg("hvh_start", "hackerName", h.name, "victimName", v.name));
            out.toHosts(Json.msg("narrate", "key", "hvh", "vars", Json.obj("hacker", h.name, "victim", v.name)));
            log.log(roomId, round, h.id, "hvh_start", Json.obj("victim", v.id));
        }
    }

    private void endPlay(long now) {
        if (freezeEndsAt >= 0) endFreeze();
        // Unfinished duels are called off without payouts when the round ends.
        for (Duel d : duels.values()) {
            out.toPlayer(d.a, Json.msg("duel_end", "duelId", d.id, "aborted", true));
            out.toPlayer(d.b, Json.msg("duel_end", "duelId", d.id, "aborted", true));
        }
        duels.clear();
        nextDuelAt.clear();
        if (rivalEventEndsAt >= 0) {
            out.toAll(Json.msg("rival_event_end"));
            rivalEventEndsAt = -1;
            rivalEventClosesAt = -1;
        }
        for (PlayerState p : players.values()) {
            p.attempt = null;
            p.nextAssignAt = -1;
        }
    }

    private void finishRound(long now) {
        if (!rivalRound && !players.isEmpty()) paidJobsPerPlayer = (double) roundSuccesses / players.size();
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
        for (PlayerState p : players.values()) p.sabotageUsed = false;
        if (!teamOf.isEmpty()) {
            String[] swap = Teams.maybeSwap(b, rng, teamOf);
            if (swap != null) {
                teamOf.forEach((id, t) -> players.get(id).team = t);
                out.toAll(Json.msg("teams_update", "teams", teamOf, "swapped", List.of(swap[0], swap[1])));
                log.log(roomId, round, null, "team_swap", Json.obj("a", swap[0], "b", swap[1]));
            }
        }
        for (PlayerState p : players.values()) out.toPlayer(p.id, betweenMsg(p));
        out.toHosts(betweenMsg(null));
    }

    private Map<String, Object> betweenMsg(PlayerState p) {
        boolean sabotageOpen = round + 1 >= b.i("sabotage.fromRound");
        List<String> immune = new ArrayList<>();
        for (PlayerState x : players.values()) if (Sabotage.immune(x, round)) immune.add(x.id);
        return Json.msg("between", "nextRound", round + 1, "overtime", Math.max(0, round + 1 - totalRounds()),
                "sabotage", sabotageOpen && (p == null || !p.sabotageUsed),
                "modifiers", sabotageOpen ? b.strings("sabotage.modifiers") : List.of(), "immune", immune, "endsAt", phaseEndsAt);
    }

    private void finishGame(long now) {
        // v2: no escape phase. Every wallet is banked automatically.
        for (PlayerState p : players.values()) {
            long banked = Economy.bankWallet(p);
            if (banked > 0) log.log(roomId, round, p.id, "auto_bank", Json.obj("banked", banked, "stash", p.stash));
        }
        List<PlayerState> ranked = Endgame.standings(players.values());
        List<Map<String, Object>> rows = new ArrayList<>();
        for (int i = 0; i < ranked.size(); i++) {
            PlayerState p = ranked.get(i);
            rows.add(Json.obj("rank", i + 1, "id", p.id, "name", p.name, "face", p.face, "stash", p.stash,
                    "successes", p.successes, "fails", p.fails, "bounties", p.bounties, "team", p.team));
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
        boolean duel = false;
        g = pickGame(roundType.tags(), false);
        seed = rng.seed();
        if (g == null) {
            p.nextAssignAt = -1;
            return;
        }
        // v2: each queued sabotage hits exactly one minigame, and never two minigames in a row.
        p.prevHit = p.curHit;
        List<ModifierSpec> mods = !p.prevHit && !p.activeModifiers.isEmpty() ? List.of(p.activeModifiers.remove(0)) : List.of();
        p.curHit = !mods.isEmpty();
        if (p.curHit) p.lastHitRound = round;
        p.attempt = new Attempt("a" + (++seq), g.id(), difficulty, speed, seed, now, mods, duel);
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
        if (rivalEventEndsAt >= 0) {
            // v3: jobs are paused during a rival event (phones freeze their minigame); a result that slips in anyway
            // doesn't count, and the player gets a fresh job when the event ends.
            p.attempt = null;
            p.nextAssignAt = Long.MAX_VALUE;
            out.toPlayer(p.id, Json.msg("minigame_ack", "attemptId", a.id(), "accepted", false, "reason", "paused"));
            return;
        }
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
            long want = Economy.successAmount(base, roundType.payoutMult() * payoutScale, score, tier.payoutMult());
            delta = Economy.payout(ledger, p, want);
            // PR-02: optional calm bonus when the Presage heart-rate module reports the player kept their cool.
            if (msg.path("nerves").path("calm").asBoolean(false) && b.strings("presage.games").contains(a.gameId())) {
                delta += Economy.payout(ledger, p, b.l("presage.calmBonus"));
            }
            p.successes++;
            roundSuccesses++;
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

        afterBankChange(now);
        dirty = true;
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

    // ------------------------------------------------------------------ v3 rival duels

    /** Random pairing of everyone in {@code ids} (must be even). Returns a symmetric map: id -> opponent id. */
    private Map<String, String> pairUp(List<String> ids) {
        List<String> order = rng.shuffled(ids);
        Map<String, String> m = new HashMap<>();
        for (int i = 0; i + 1 < order.size(); i += 2) {
            m.put(order.get(i), order.get(i + 1));
            m.put(order.get(i + 1), order.get(i));
        }
        return m;
    }

    /** A rival event needs an even crew, so nobody is left without a rival. Everyone in the room counts (a phone that
     *  blinked offline is still playing); someone who stays gone forfeits their duel after a few seconds. */
    private boolean rivalEventAllowed() {
        int n = players.size();
        return n >= 2 && n % 2 == 0 && round >= b.i("rivalEvent.fromRound");
    }

    private List<Map<String, Object>> pairsWire() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (var e : rivalOf.entrySet()) {
            if (e.getKey().compareTo(e.getValue()) > 0) continue;
            PlayerState a = players.get(e.getKey()), c = players.get(e.getValue());
            if (a == null || c == null) continue;
            list.add(Json.obj("a", Json.obj("id", a.id, "name", a.name, "face", a.face), "b", Json.obj("id", c.id, "name", c.name, "face", c.face)));
        }
        return list;
    }

    private Duel startDuel(String a, String c, Duel.Kind kind, boolean event, long now) {
        Duel d = new Duel("d" + (++seq), kind, a, c, event, now, b, rng);
        duels.put(d.id, d);
        out.toPlayer(a, duelStartMsg(d, a, now));
        out.toPlayer(c, duelStartMsg(d, c, now));
        PlayerState pa = players.get(a), pc = players.get(c);
        out.toHosts(Json.msg("duel_start", "duelId", d.id, "kind", kind.id, "name", kind.title, "event", event,
                "a", Json.obj("id", pa.id, "name", pa.name, "face", pa.face), "b", Json.obj("id", pc.id, "name", pc.name, "face", pc.face),
                "startsAt", d.startsAt, "endsAt", d.endsAt, "now", now));
        log.log(roomId, round, a, "duel_start", Json.obj("duel", d.id, "kind", kind.id, "opponent", c, "event", event));
        return d;
    }

    /** What one duelist's phone needs: the game, its opponent (face + name), timings and the shared setup. */
    private Map<String, Object> duelStartMsg(Duel d, String pid, long now) {
        PlayerState opp = players.get(d.opponent(pid));
        return Json.msg("duel_start", "duelId", d.id, "kind", d.kind.id, "name", d.kind.title, "file", "/rival/" + d.kind.id + ".js",
                "you", d.a.equals(pid) ? "a" : "b", "event", d.event,
                "opponent", opp == null ? null : Json.obj("id", opp.id, "name", opp.name, "face", opp.face),
                "record", Json.obj("you", duelWins.getOrDefault(pid, 0), "them", opp == null ? 0 : duelWins.getOrDefault(opp.id, 0)),
                "pot", duelPot(), "now", now, "startsAt", d.startsAt, "endsAt", d.endsAt, "setup", d.setup());
    }

    private long duelPot() {
        long base = b.ints("payout.byDifficulty").get(difficulty - 1);
        return Math.max(1, Math.round(base * b.d("rival.potMult") * payoutScale));
    }

    private void onDuelInput(PlayerState p, JsonNode msg, long now) {
        Duel d = duels.get(Json.str(msg, "duelId", ""));
        if (d == null || !d.has(p.id)) return; // late input for a finished duel: ignore quietly
        d.input(p.id, msg, now);
        if (d.over()) settleDuel(d, now);
    }

    private void tickDuels(long now) {
        long forfeitMs = b.l("rival.forfeitAfterDisconnectMs");
        for (Duel d : new ArrayList<>(duels.values())) {
            if (d.over()) continue;
            for (String id : List.of(d.a, d.b)) {
                PlayerState p = players.get(id);
                if (p == null || (!p.connected && p.disconnectedAt >= 0 && now - p.disconnectedAt > forfeitMs)) d.forfeit(id);
            }
            d.tick(now);
            if (d.over()) {
                settleDuel(d, now);
                continue;
            }
            // Live state at ~12Hz per duel (taps arrive faster than that).
            if (d.dirty && (d.lastSentAt < 0 || now - d.lastSentAt >= 80)) {
                Map<String, Object> st = d.state();
                out.toPlayer(d.a, st);
                out.toPlayer(d.b, st);
                out.toHosts(st);
                d.dirty = false;
                d.lastSentAt = now;
            }
        }
        // Rival round: each pair starts its next duel after a short breather, while there is time for one.
        if (rivalRound) {
            for (var e : nextDuelAt.entrySet()) {
                if (e.getValue() < 0 || now < e.getValue()) continue;
                String a = e.getKey(), c = rivalOf.get(a);
                e.setValue(-1L);
                if (c == null) continue;
                List<Duel.Kind> fit = new ArrayList<>();
                for (String g : b.strings("rival.roundGames")) {
                    long need = b.l("rival.countdownMs") + b.l("rival.games." + g + ".durationMs") + 500;
                    if (now + need <= phaseEndsAt) fit.add(Duel.Kind.of(g));
                }
                if (!fit.isEmpty()) startDuel(a, c, rng.pick(fit), false, now);
            }
        }
        // Rival event: once every duel is decided (plus a moment to see the result), give the round its time back.
        if (rivalEventEndsAt >= 0) {
            boolean live = duels.values().stream().anyMatch(d -> d.event && !d.over());
            if (!live && rivalEventClosesAt < 0) rivalEventClosesAt = now + b.l("rival.resultMs");
            if (now >= rivalEventEndsAt || (rivalEventClosesAt >= 0 && now >= rivalEventClosesAt)) closeRivalEvent(now);
        }
    }

    private void settleDuel(Duel d, long now) {
        duels.remove(d.id);
        PlayerState w = d.winner() == null ? null : players.get(d.winner());
        PlayerState l = d.winner() == null ? null : players.get(d.opponent(d.winner()));
        long won = 0, pen = 0;
        if (w != null) {
            won = Economy.payout(ledger, w, duelPot());
            duelWins.merge(w.id, 1, Integer::sum);
            w.successes++;
        }
        if (l != null) {
            pen = Economy.penalty(ledger, l, b.l("rival.loserPenalty"));
            l.fails++;
        }
        Map<String, Object> end = Json.msg("duel_end", "duelId", d.id, "kind", d.kind.id, "winnerId", w == null ? null : w.id,
                "winnerName", w == null ? null : w.name, "loserId", l == null ? null : l.id, "draw", d.isDraw(), "reason", d.reason(),
                "amount", won, "penalty", pen, "state", d.state());
        out.toPlayer(d.a, end);
        out.toPlayer(d.b, end);
        out.toHosts(end);
        if (w != null && rng.chance(0.3)) out.toHosts(Json.msg("narrate", "key", "rival_win", "vars", Json.obj("name", w.name)));
        log.log(roomId, round, w == null ? null : w.id, "duel_end", Json.obj("duel", d.id, "kind", d.kind.id, "loser", l == null ? null : l.id,
                "draw", d.isDraw(), "reason", d.reason(), "amount", won, "penalty", pen, "bank", ledger.bank));
        if (rivalRound && !d.event) nextDuelAt.put(d.a.compareTo(d.b) < 0 ? d.a : d.b, now + b.l("rival.betweenDuelsMs"));
        if (d.event && rivalEventEndsAt >= 0 && rivalEventClosesAt < 0 && duels.values().stream().noneMatch(x -> x.event && !x.over())) {
            rivalEventClosesAt = now + b.l("rival.resultMs"); // last duel decided: show the results briefly, then resume
        }
        afterBankChange(now);
        dirty = true;
    }

    /** Random mid-round event: everyone's minigame pauses, the crew is re-paired at random, and every pair duels once. */
    private void openRivalEvent(long now) {
        if (phase != Phase.PLAY || rivalRound || rivalEventEndsAt >= 0) return;
        List<String> ids = new ArrayList<>(players.keySet());
        if (ids.size() < 2 || ids.size() % 2 != 0) return; // odd crew: nobody may be left idle, so skip the event
        rivalOf = pairUp(ids);
        Duel.Kind kind = Duel.Kind.of(rng.pick(b.strings("rivalEvent.games")));
        long window = b.l("rival.countdownMs") + b.l("rival.games." + kind.id + ".durationMs") + b.l("rival.resultMs");
        // Like a Freeze, the event pauses the round: the round end and later events move back by the window.
        phaseEndsAt += window;
        playStartedAt += window;
        rivalEventEndsAt = now + window;
        rivalEventClosesAt = -1;
        out.toAll(Json.msg("rival_event_start", "endsAt", rivalEventEndsAt, "now", now, "kind", kind.id, "name", kind.title,
                "roundEndsAt", phaseEndsAt));
        out.toHosts(Json.msg("rival_round", "pairs", pairsWire(), "event", true));
        out.toHosts(Json.msg("narrate", "key", "rival", "vars", Json.obj()));
        log.log(roomId, round, null, "rival_event", Json.obj("kind", kind.id, "pairs", ids.size() / 2));
        for (var e : rivalOf.entrySet()) if (e.getKey().compareTo(e.getValue()) < 0) startDuel(e.getKey(), e.getValue(), kind, true, now);
        dirty = true;
    }

    private void closeRivalEvent(long now) {
        long unused = rivalEventEndsAt - now;
        if (unused > 0) { // finished early: hand the unused pause back to the round
            phaseEndsAt -= unused;
            playStartedAt -= unused;
        }
        for (Duel d : new ArrayList<>(duels.values())) if (d.event) {
            d.tick(Long.MAX_VALUE);
            settleDuel(d, now);
        }
        rivalEventEndsAt = -1;
        rivalEventClosesAt = -1;
        for (PlayerState p : players.values()) if (p.attempt == null && p.nextAssignAt > now) p.nextAssignAt = now + 400;
        out.toAll(Json.msg("rival_event_end", "roundEndsAt", phaseEndsAt, "now", now));
        dirty = true;
    }

    // ------------------------------------------------------------------ timed events

    private void openEvent(EventScheduler.Kind kind, long now, long dur) {
        switch (kind) {
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
            case RIVAL -> openRivalEvent(now);
        }
        dirty = true;
    }

    private void closeExpiredWindows(long now) {
        if (freezeEndsAt >= 0 && now >= freezeEndsAt + b.l("freeze.graceMs")) endFreeze();
    }

    private void endFreeze() {
        out.toAll(Json.msg("freeze_end"));
        freezeStart = -1;
        freezeEndsAt = -1;
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
            case "minigame_result" -> onResult(p, msg, now);
            case "freeze_violation" -> onFreezeViolation(p, now);
            case "duel_input" -> onDuelInput(p, msg, now);
            case "sabotage" -> onSabotage(p, msg);
            case "hack_scramble" -> onScramble(p, now);
            default -> throw new GameError("unknown_intent", "Unknown message " + t);
        }
    }

    private void onSabotage(PlayerState p, JsonNode msg) {
        PlayerState target = players.get(Json.str(msg, "targetId", ""));
        String mod = Json.str(msg, "modifier", "");
        ModifierSpec spec = Sabotage.validate(b, phase, round + 1, p, target, mod, players);
        target.pendingModifiers.add(spec);
        p.sabotageUsed = true;
        out.toPlayer(p.id, Json.msg("sabotage_ack", "targetId", target.id, "targetName", target.name, "targetFace", target.face, "modifier", mod));
        out.toHosts(Json.msg("fx", "kind", "sabotage", "modifier", mod));
        log.log(roomId, round, p.id, "sabotage", Json.obj("target", target.id, "modifier", mod));
    }

    private void onScramble(PlayerState p, long now) {
        if (phase != Phase.PLAY || hvh == null || hvh.usesLeft <= 0 || !hvh.hacker.equals(p.id)) throw new GameError("no_power", "You have no scrambles");
        PlayerState v = players.get(hvh.victim);
        // v2: never two of the victim's minigames in a row.
        if (v.prevHit) throw new GameError("victim_cooldown", v.name + " was just hit. Wait for their next job");
        if (!hvh.use(p.id)) throw new GameError("no_power", "You have no scrambles");
        v.curHit = true;
        v.lastHitRound = round;
        long ms = b.l("hackerVsHacker.scrambleMs");
        v.jammedUntil = now + ms;
        out.toPlayer(v.id, Json.msg("modifier_apply", "id", "jam-the-signal", "durationMs", ms, "strength", b.d("hackerVsHacker.scrambleStrength")));
        out.toPlayer(p.id, Json.msg("hvh_ack", "usesLeft", hvh.usesLeft));
        out.toHosts(Json.msg("narrate", "key", "hvh_scramble", "vars", Json.obj("hacker", p.name, "victim", v.name)));
        log.log(roomId, round, p.id, "hvh_scramble", Json.obj("victim", v.id));
    }

    // ------------------------------------------------------------------ admin (TL-02)

    public void admin(JsonNode msg, long now) {
        String action = Json.str(msg, "action", "");
        switch (action) {
            case "force_freeze" -> forceEvent(EventScheduler.Kind.FREEZE, now);
            case "force_rival" -> {
                if (phase != Phase.PLAY || rivalRound || rivalEventEndsAt >= 0) throw new GameError("wrong_phase", "Rival events fire during a normal round's play");
                openRivalEvent(now);
            }
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
        if (freezeEndsAt >= 0) return Json.obj("type", "freeze", "endsAt", freezeEndsAt);
        if (rivalEventEndsAt >= 0) return Json.obj("type", "rival", "endsAt", rivalEventEndsAt);
        return null;
    }

    /** The public part of the state message (identical for everybody). */
    public Map<String, Object> publicState(long now) {
        List<Map<String, Object>> ps = new ArrayList<>();
        for (PlayerState p : players.values()) {
            ps.add(Json.obj("id", p.id, "name", p.name, "face", p.face, "wallet", p.wallet, "stash", p.stash, "on", p.connected ? 1 : 0,
                    "team", p.team, "bot", p.bot ? 1 : null));
        }
        return Json.msg("state", "room", roomId, "phase", phase.wire(), "round", round, "rounds", totalRounds(), "overtime", overtime(),
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
        return Json.obj("id", p.id, "face", p.face, "target", t == null ? null : Json.obj("id", t.id, "name", t.name, "face", t.face),
                "team", p.team);
    }

    /** Re-send everything a reconnecting phone needs to land back in the current phase (BE-02). */
    public void resync(String pid, long now) {
        PlayerState p = player(pid);
        Map<String, Object> m = new LinkedHashMap<>(publicState(now));
        m.put("me", meWire(p));
        out.toPlayer(pid, Json.msg("phase_changed", "phase", phase.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "banner", roundType == null ? null : roundType.banner(),
                "endsAt", phaseEndsAt, "now", now, "overtime", overtime(), "resync", true));
        out.toPlayer(pid, m);
        if (phase == Phase.BETWEEN) {
            out.toPlayer(pid, betweenMsg(p));
        }
        if (phase == Phase.PLAY && p.attempt != null) sendAssign(p);
        if (phase == Phase.PLAY && p.attempt == null && p.nextAssignAt < 0 && !rivalRound) {
            p.nextAssignAt = now;
        }
        // v3: a reconnecting phone lands back in its live duel (and the rival event, if one is running).
        if (phase == Phase.PLAY && rivalEventEndsAt >= 0) out.toPlayer(pid, Json.msg("rival_event_start", "endsAt", rivalEventEndsAt, "now", now));
        for (Duel d : duels.values()) if (d.has(pid) && !d.over()) {
            out.toPlayer(pid, duelStartMsg(d, pid, now));
            out.toPlayer(pid, d.state());
        }
        if (freezeEndsAt >= 0) out.toPlayer(pid, Json.msg("freeze_start", "endsAt", freezeEndsAt, "now", now));
        if (hvh != null && hvh.hacker.equals(pid) && phase == Phase.PLAY) {
            PlayerState v = players.get(hvh.victim);
            out.toPlayer(pid, Json.msg("hvh_power", "victimId", v.id, "victimName", v.name, "victimFace", v.face, "uses", hvh.usesLeft,
                    "scrambleMs", b.l("hackerVsHacker.scrambleMs")));
        }
        if (phase == Phase.END && finalStandings != null) out.toPlayer(pid, finalStandings);
    }

    /** Snapshot for a (re)connecting host screen. */
    public void resyncHost(java.util.function.Consumer<Map<String, Object>> send, long now) {
        send.accept(Json.msg("phase_changed", "phase", phase.wire(), "round", round, "rounds", totalRounds(),
                "roundType", roundType == null ? null : roundType.id(), "banner", roundType == null ? null : roundType.banner(),
                "endsAt", phaseEndsAt, "now", now, "overtime", overtime(), "resync", true));
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

    public Map<String, Duel> duels() {
        return duels;
    }

    public Map<String, String> rivalPairs() {
        return rivalOf;
    }

    public boolean isRivalRound() {
        return rivalRound;
    }

    public long rivalEventEndsAt() {
        return rivalEventEndsAt;
    }

    public HackerVsHacker hvh() {
        return hvh;
    }

    public Map<String, Object> finalStandings() {
        return finalStandings;
    }

    public double payoutScale() {
        return payoutScale;
    }

    public void openForTest(EventScheduler.Kind k, long now) {
        openEvent(k, now, EventScheduler.duration(b, k));
    }

    public Balance balance() {
        return b;
    }
}
