package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.TestSupport;
import heist.config.Balance;
import heist.util.Clock;
import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** BE-03 done-when: unit tests walk a full 6-round game (plus the rules hanging off it). */
class GameEngineTest {
    private final Balance b = TestSupport.BALANCE;

    private static JsonNode j(Object... kv) {
        return Json.MAPPER.valueToTree(Json.obj(kv));
    }

    /** Drive the engine with a manual clock; every attempt is answered after `solveMs` (success on even attempts). */
    private static List<Phase> play(GameEngine g, Clock.Manual clock, long solveMs) {
        List<Phase> phases = new ArrayList<>();
        Map<String, Long> answerAt = new java.util.HashMap<>();
        int guard = 0;
        while (g.phase() != Phase.END && guard++ < 200_000) {
            clock.advance(50);
            g.tick(clock.now());
            if (phases.isEmpty() || phases.get(phases.size() - 1) != g.phase()) phases.add(g.phase());
            assertNull(g.invariantError(), "money invariant after tick at " + g.phase());
            for (PlayerState p : g.players().values()) {
                if (g.phase() == Phase.PLAY && p.attempt != null) {
                    long due = answerAt.computeIfAbsent(p.attempt.id(), k -> clock.now() + solveMs);
                    if (clock.now() >= due) {
                        boolean ok = Integer.parseInt(p.attempt.id().substring(1)) % 2 == 0;
                        g.handle(p.id, j("t", "minigame_result", "attemptId", p.attempt.id(), "success", ok), clock.now());
                    }
                }
            }
        }
        return phases;
    }

    @Test
    void walksAFullSixRoundGame() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 1234);
        for (int i = 0; i < 4; i++) g.addPlayer("Bot" + i, true);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(clock.now());
        // Slow solving so the bank survives all 6 rounds.
        play(g, clock, 9_000);
        assertEquals(Phase.END, g.phase());
        List<Object> sequence = new ArrayList<>();
        for (Map<String, Object> m : out.of("phase_changed")) sequence.add(m.get("phase") + "" + m.get("round"));
        int last = g.round();
        assertTrue(last >= 6, "the host's 6 rounds are always played unless the bank empties");
        List<Object> expected = new ArrayList<>();
        for (int r = 1; r <= last; r++) {
            expected.add("briefing" + r);
            expected.add("play" + r);
            expected.add("results" + r);
            if (r < last) expected.add("between" + r);
        }
        expected.add("end" + last);
        assertEquals(expected, sequence);
        // v2: no escape phase, and the game only ends once the bank is empty (or the overtime safety cap).
        assertTrue(g.ledger().bankEmpty() || last == 6 + b.i("economy.overtimeMaxRounds"), "bank " + g.ledger().bank + " after round " + last);

        // Speed ramp (BE-04) and round types (BE-10) in round_start.
        List<Map<String, Object>> starts = out.to("p1", "round_start");
        assertEquals(last, starts.size());
        for (int r = 1; r <= 6; r++) {
            assertEquals(Speed.forRound(b, r), starts.get(r - 1).get("speed"));
            assertEquals(b.strings("roundTypes.sequence").get(r - 1), starts.get(r - 1).get("roundType"));
        }
        assertTrue((double) starts.get(5).get("speed") > (double) starts.get(0).get("speed"));

        // Exactly one winner, every wallet was banked automatically so nothing was lost.
        Map<String, Object> fin = g.finalStandings();
        assertNotNull(fin.get("winnerId"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) fin.get("standings");
        assertEquals(1, rows.stream().filter(r -> (int) r.get("rank") == 1).count());
        long stashes = 0;
        for (PlayerState p : g.players().values()) {
            assertEquals(0, p.wallet);
            stashes += p.stash;
        }
        assertEquals(g.ledger().bankStart - g.ledger().bank, stashes, "everything paid out ends up in a stash");
        assertNull(g.invariantError());
    }

    @Test
    void payoutsScaleSoTheBankDrainsOverTheChosenRounds() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 8);
        for (int i = 0; i < 4; i++) g.addPlayer("P" + i, false);
        g.settings.rounds = 3;
        g.start(0);
        double three = g.payoutScale();
        TestSupport.Capture out2 = new TestSupport.Capture();
        GameEngine g2 = TestSupport.engine(out2, 8);
        for (int i = 0; i < 4; i++) g2.addPlayer("P" + i, false);
        g2.settings.rounds = 12;
        g2.start(0);
        assertTrue(three > g2.payoutScale(), "fewer rounds pay out more per job: " + three + " vs " + g2.payoutScale());
        assertEquals(three, out.last("p1", "round_start").get("payoutScale"));
    }

    @Test
    void penaltiesGoBackIntoTheBank() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 4);
        PlayerState a = g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        g.admin(j("action", "grant", "playerId", a.id, "amount", 500), clock.now());
        long bank = g.ledger().bank;
        clock.advance(50);
        g.tick(clock.now());
        clock.advance(b.l("minigame.minSolveMs") + 1);
        g.handle(a.id, j("t", "minigame_result", "attemptId", a.attempt.id(), "success", false), clock.now());
        long pen = 500 - a.wallet;
        assertTrue(pen > 0);
        assertEquals(bank + pen, g.ledger().bank);
        assertNull(g.invariantError());
    }

    @Test
    void everyPlayerGetsADistinctAnimalFace() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 2);
        java.util.Set<String> faces = new java.util.HashSet<>();
        for (int i = 0; i < b.i("players.max"); i++) faces.add(g.addPlayer("P" + i, false).face);
        assertEquals(b.i("players.max"), faces.size());
        assertTrue(TestSupport.CONTENT.animalFaces.containsAll(faces));
    }

    @Test
    void phaseChangesCarryServerTime() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 5);
        g.addPlayer("A", false);
        g.addPlayer("B", false);
        g.start(777);
        Map<String, Object> pc = out.of("phase_changed").get(0);
        assertEquals(777L, pc.get("now"));
        assertEquals(777L + b.l("rounds.briefingMs"), pc.get("endsAt"));
    }

    @Test
    void bankruptcyEndsPlayEarlyAndEndsTheGame() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 99);
        for (int i = 0; i < 3; i++) g.addPlayer("P" + i, false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(clock.now());
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        g.admin(j("action", "set_bank", "amount", 80), clock.now());
        clock.advance(50);
        g.tick(clock.now());
        PlayerState p = g.players().values().iterator().next();
        clock.advance(b.l("minigame.minSolveMs") + 1);
        g.handle(p.id, j("t", "minigame_result", "attemptId", p.attempt.id(), "success", true), clock.now());
        assertEquals(0, g.ledger().bank);
        clock.advance(50);
        g.tick(clock.now());
        assertEquals(Phase.RESULTS, g.phase());
        clock.advance(b.l("rounds.resultsMs") + 50);
        g.tick(clock.now());
        assertEquals(Phase.END, g.phase(), "an empty bank ends the game, wallets banked automatically");
        for (PlayerState x : g.players().values()) assertEquals(0, x.wallet);
        assertFalse(out.of("bank_warning").isEmpty());
    }

    @Test
    void resultsThatArriveTooFastAreRejected() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 3);
        PlayerState a = g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        clock.advance(50);
        g.tick(clock.now());
        String id = a.attempt.id();
        clock.advance(10);
        g.handle(a.id, j("t", "minigame_result", "attemptId", id, "success", true), clock.now());
        Map<String, Object> ack = out.last(a.id, "minigame_ack");
        assertEquals(false, ack.get("accepted"));
        assertEquals("too_fast", ack.get("reason"));
        assertEquals(0, a.wallet);
        assertThrows(GameError.class, () -> g.handle(a.id, j("t", "minigame_result", "attemptId", id, "success", true), clock.now()),
                "an attempt can only be answered once");
    }

    @Test
    void wagerTierScalesPayoutOnlyForChoiceGames() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine.Settings s = new GameEngine.Settings();
        s.seed = 11L;
        s.games = List.of("password-roulette");
        GameEngine g = new GameEngine("T", b, out, null, TestSupport.CATALOG, TestSupport.CONTENT, TestSupport.SIGNER, s);
        PlayerState a = g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        clock.advance(50);
        g.tick(clock.now());
        clock.advance(2000);
        g.handle(a.id, j("t", "minigame_result", "attemptId", a.attempt.id(), "success", true, "wager", Map.of("tier", "3")), clock.now());
        long base = b.ints("payout.byDifficulty").get(0);
        assertEquals(Math.round(base * b.d("roundTypes.breakin.payoutMult") * g.payoutScale() * b.d("wager.tiers.3.payoutMult")), a.wallet);
    }

    @Test
    void sabotageIsValidatedAndInjectedIntoTheNextRound() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 21);
        PlayerState a = g.addPlayer("A", false), c = g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.BETWEEN) { clock.advance(100); g.tick(clock.now()); }
        assertThrows(GameError.class, () -> g.handle(a.id, j("t", "sabotage", "targetId", a.id, "modifier", "screen-jitter"), clock.now()));
        assertThrows(GameError.class, () -> g.handle(a.id, j("t", "sabotage", "targetId", c.id, "modifier", "nuke"), clock.now()));
        g.handle(a.id, j("t", "sabotage", "targetId", c.id, "modifier", "screen-jitter"), clock.now());
        assertThrows(GameError.class, () -> g.handle(a.id, j("t", "sabotage", "targetId", c.id, "modifier", "screen-jitter"), clock.now()), "one per round");
        while (g.phase() != Phase.BRIEFING) { clock.advance(100); g.tick(clock.now()); }
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> mods = (List<Map<String, Object>>) out.last(c.id, "round_start").get("modifiers");
        assertEquals("screen-jitter", mods.get(0).get("id"));
        while (g.phase() != Phase.PLAY) { clock.advance(100); g.tick(clock.now()); }
        clock.advance(50);
        g.tick(clock.now());
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> assigned = (List<Map<String, Object>>) out.last(c.id, "minigame_assign").get("modifiers");
        assertEquals(1, assigned.size());
    }

    @SuppressWarnings("unchecked")
    @Test
    void attacksNeverHitTwoMinigamesInARowNorTheSameTargetTwoRoundsRunning() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 21);
        PlayerState a = g.addPlayer("A", false), c = g.addPlayer("B", false), d = g.addPlayer("C", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.BETWEEN) { clock.advance(100); g.tick(clock.now()); }
        // Two sabotages queued on the same victim.
        g.handle(a.id, j("t", "sabotage", "targetId", c.id, "modifier", "screen-jitter"), clock.now());
        g.handle(d.id, j("t", "sabotage", "targetId", c.id, "modifier", "false-alarm"), clock.now());
        while (g.phase() != Phase.PLAY) { clock.advance(100); g.tick(clock.now()); }
        List<Integer> hits = new ArrayList<>();
        int seen = 0, guard = 0;
        while (g.phase() == Phase.PLAY && hits.size() < 5 && guard++ < 10_000) {
            clock.advance(50);
            g.tick(clock.now());
            List<Map<String, Object>> assigns = out.to(c.id, "minigame_assign");
            if (c.attempt != null && assigns.size() > seen) {
                seen = assigns.size();
                hits.add(((List<Object>) assigns.get(seen - 1).get("modifiers")).size());
                clock.advance(b.l("minigame.minSolveMs") + 1);
                g.handle(c.id, j("t", "minigame_result", "attemptId", c.attempt.id(), "success", true), clock.now());
            }
        }
        assertEquals(List.of(1, 0, 1, 0, 0), hits, "one sabotage per minigame, never two in a row");
        while (g.phase() != Phase.BETWEEN) { clock.advance(100); g.tick(clock.now()); }
        assertTrue(((List<Object>) out.last(a.id, "between").get("immune")).contains(c.id));
        assertThrows(GameError.class, () -> g.handle(a.id, j("t", "sabotage", "targetId", c.id, "modifier", "screen-jitter"), clock.now()),
                "a player hit last round can't be picked again right away");
        g.handle(a.id, j("t", "sabotage", "targetId", d.id, "modifier", "screen-jitter"), clock.now());
    }

    @Test
    void cardVoteMajorityAppliesEffect() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 31);
        PlayerState a = g.addPlayer("A", false), c = g.addPlayer("B", false), d = g.addPlayer("C", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.BETWEEN) { clock.advance(100); g.tick(clock.now()); }
        long before = a.wallet;
        g.handle(a.id, j("t", "card_play", "number", 1), clock.now());
        String vote = (String) out.of("card_vote_open").get(0).get("voteId");
        g.handle(c.id, j("t", "card_vote", "voteId", vote, "pass", true), clock.now());
        g.handle(d.id, j("t", "card_vote", "voteId", vote, "pass", true), clock.now());
        Map<String, Object> res = out.of("card_vote_result").get(0);
        assertEquals(true, res.get("passed"));
        assertEquals(before + b.l("cards.dare.success"), a.wallet);
        // Opting out of a physical card is free.
        PlayerState x = c;
        long w = x.wallet;
        g.handle(x.id, j("t", "card_play", "number", 5), clock.now());
        String v2 = (String) out.of("card_vote_open").get(1).get("voteId");
        g.handle(x.id, j("t", "card_optout", "voteId", v2), clock.now());
        assertEquals(w, x.wallet);
        assertNull(g.invariantError());
    }

    @Test
    void freezeViolationsArePenalisedOncePerWindow() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 41);
        PlayerState a = g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        g.admin(j("action", "grant", "playerId", a.id, "amount", 500), clock.now());
        g.admin(j("action", "force_freeze"), clock.now());
        g.handle(a.id, j("t", "freeze_violation"), clock.now());
        g.handle(a.id, j("t", "freeze_violation"), clock.now());
        assertEquals(500 - b.l("freeze.violationPenalty"), a.wallet);
        assertEquals(1, out.to(a.id, "freeze_penalty").size());
    }

    @Test
    void freezePausesTheRoundForEveryone() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 43);
        g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        long before = g.phaseEndsAt();
        g.admin(j("action", "force_freeze"), clock.now());
        assertEquals(before + b.l("freeze.windowMs"), g.phaseEndsAt(), "round end pushed back by the freeze");
        assertEquals(g.phaseEndsAt(), out.of("freeze_start").get(0).get("roundEndsAt"));
    }

    @Test
    void scheduledFreezesAreAnnouncedBeforeTheyStart() {
        for (long seed = 0; seed < 40; seed++) {
            TestSupport.Capture out = new TestSupport.Capture();
            GameEngine g = TestSupport.engine(out, seed);
            g.addPlayer("A", false);
            g.addPlayer("B", false);
            Clock.Manual clock = new Clock.Manual(0);
            g.start(0);
            while (g.phase() != Phase.BETWEEN && g.phase() != Phase.END) { clock.advance(50); g.tick(clock.now()); }
            var warnings = out.of("freeze_warning");
            var starts = out.of("freeze_start");
            assertEquals(starts.size(), warnings.size(), "every freeze is warned (seed " + seed + ")");
            for (int i = 0; i < starts.size(); i++) {
                long warnedAt = (long) warnings.get(i).get("now");
                long started = (long) starts.get(i).get("now");
                assertTrue(started - warnedAt >= b.l("freeze.warningMs") - 100, "warning lead " + (started - warnedAt));
            }
        }
    }

    @Test
    void bankRaidPaysFirstNByReceiveOrder() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 51);
        List<PlayerState> ps = new ArrayList<>();
        for (int i = 0; i < 6; i++) ps.add(g.addPlayer("P" + i, false));
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        g.admin(j("action", "force_bankraid"), clock.now());
        for (PlayerState p : ps) g.handle(p.id, j("t", "bankraid_grab"), clock.now());
        Map<String, Object> res = out.of("bankraid_result").get(0);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> winners = (List<Map<String, Object>>) res.get("winners");
        assertEquals(b.i("bankRaid.winners"), winners.size());
        assertEquals(ps.get(0).id, winners.get(0).get("id"));
        long each = b.l("bankRaid.bonusTotal") / b.i("bankRaid.winners");
        assertEquals(each, ps.get(0).wallet);
        assertEquals(0, ps.get(5).wallet);
    }

    @Test
    void rivalRoundGivesBothDuelistsTheSameSeedsAndPaysTheFirstSuccess() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 61);
        for (int i = 0; i < 4; i++) g.addPlayer("P" + i, false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        int rivalRound = b.strings("roundTypes.sequence").indexOf("rival") + 1;
        while (!(g.phase() == Phase.PLAY && g.round() == rivalRound)) {
            clock.advance(100);
            g.tick(clock.now());
            for (PlayerState p : g.players().values()) if (g.phase() == Phase.PLAY && p.attempt != null && clock.now() - p.attempt.issuedAt() > 9000) {
                g.handle(p.id, j("t", "minigame_result", "attemptId", p.attempt.id(), "success", false), clock.now());
            }
        }
        clock.advance(50);
        g.tick(clock.now());
        RivalHeist r = g.rival();
        assertNotNull(r);
        PlayerState a = g.players().get(r.a), c = g.players().get(r.b);
        assertEquals(a.attempt.seed(), c.attempt.seed(), "same puzzle for both duelists");
        assertEquals(a.attempt.gameId(), c.attempt.gameId());
        long spectators = g.players().values().stream().filter(p -> !r.isDuelist(p.id) && p.attempt != null).count();
        assertEquals(0, spectators, "everyone else spectates");
        long before = c.wallet;
        clock.advance(1000);
        g.handle(c.id, j("t", "minigame_result", "attemptId", c.attempt.id(), "success", true), clock.now());
        assertEquals(c.id, out.of("rival_result").get(0).get("winnerId"));
        assertTrue(c.wallet > before);
        assertNull(g.invariantError());
    }

    @Test
    void reconnectResyncsPhaseStateAndCurrentAttempt() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 71);
        PlayerState a = g.addPlayer("A", false);
        g.addPlayer("B", false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        while (g.phase() != Phase.PLAY) { clock.advance(50); g.tick(clock.now()); }
        clock.advance(50);
        g.tick(clock.now());
        g.admin(j("action", "grant", "playerId", a.id, "amount", 300), clock.now());
        String attempt = a.attempt.id();
        g.setConnected(a.id, false, clock.now());
        clock.advance(20_000);
        g.tick(clock.now());
        out.log.clear();
        g.setConnected(a.id, true, clock.now());
        g.resync(a.id, clock.now());
        assertEquals("play", out.last(a.id, "phase_changed").get("phase"));
        assertEquals(attempt, out.last(a.id, "minigame_assign").get("attemptId"), "same attempt resumes");
        assertEquals(300L, a.wallet, "wallet kept");
    }

    @Test
    void teamModeSplitsEarningsWithoutCreatingMoney() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 81);
        g.settings.teams = true;
        for (int i = 0; i < 4; i++) g.addPlayer("P" + i, false);
        Clock.Manual clock = new Clock.Manual(0);
        g.start(0);
        assertTrue(g.players().values().stream().allMatch(p -> p.team != null));
        play(g, clock, 3000);
        assertNull(g.invariantError());
        assertNotNull(g.finalStandings().get("winningTeam"));
    }

    @Test
    void lobbyRules() {
        TestSupport.Capture out = new TestSupport.Capture();
        GameEngine g = TestSupport.engine(out, 1);
        assertThrows(GameError.class, () -> g.start(0), "needs min players");
        for (int i = 0; i < b.i("players.max"); i++) g.addPlayer("P" + i, false);
        assertThrows(GameError.class, () -> g.addPlayer("Late", false));
        PlayerState dup = g.players().values().iterator().next();
        assertEquals("P0", dup.name);
        assertEquals("bx", GameEngine.cleanName("<b>x"));
    }

}
