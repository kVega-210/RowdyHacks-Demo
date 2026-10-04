package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.TestSupport;
import heist.config.Balance;
import heist.util.Json;
import heist.util.Rng;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** v3 rival duels: the server-side rules of each live duel game. */
class DuelTest {
    private final Balance b = TestSupport.BALANCE;

    private static JsonNode j(Object... kv) {
        return Json.MAPPER.valueToTree(Json.obj(kv));
    }

    private Duel duel(Duel.Kind k) {
        return new Duel("d1", k, "A", "B", false, 0, b, new Rng(5));
    }

    @Test
    void tugOfWarFirstToPullTheRopeOverWins() {
        Duel d = duel(Duel.Kind.TUG);
        long t = d.startsAt;
        assertFalse(d.input("A", j("taps", 3), d.startsAt - 1), "taps during the countdown don't count");
        int target = b.i("rival.games.tug-of-war.target");
        for (int i = 0; i < target * 2 && !d.over(); i++) {
            t += 100;
            d.input("A", j("taps", 2), t);
            if (i % 3 == 0) d.input("B", j("taps", 1), t);
        }
        assertEquals("A", d.winner());
    }

    @Test
    void tugOfWarCapsTapRate() {
        Duel d = duel(Duel.Kind.TUG);
        d.input("A", j("taps", 3), d.startsAt + 10);
        d.input("A", j("taps", 99), d.startsAt + 20); // 10ms later: capped to 1
        assertTrue((int) d.state().get("rope") <= 4);
    }

    @Test
    void typeRaceNeedsTheExactWord() {
        Duel d = duel(Duel.Kind.TYPE);
        String word = (String) d.setup().get("word");
        assertEquals(b.i("rival.games.type-race.length"), word.length());
        d.input("B", j("done", "WRONG1"), d.startsAt + 2000);
        assertFalse(d.over(), "a wrong word does nothing");
        d.input("A", j("progress", 3), d.startsAt + 2100);
        d.input("B", j("done", word), d.startsAt + 2500);
        assertEquals("B", d.winner());
    }

    @Test
    void memoryDuelFirstMistakeLoses() {
        Duel d = duel(Duel.Kind.MEMORY);
        @SuppressWarnings("unchecked")
        List<Integer> seq = (List<Integer>) d.setup().get("seq");
        for (int i = 1; i < seq.size(); i++) assertNotEquals(seq.get(i - 1), seq.get(i), "no pad twice in a row");
        int start = b.i("rival.games.memory-duel.startLength");
        long t = d.startsAt + 100;
        d.input("A", j("level", 1, "keys", seq.subList(0, start)), t);
        d.input("B", j("level", 1, "keys", seq.subList(0, start)), t);
        assertFalse(d.input("A", j("level", 3, "keys", seq.subList(0, start + 2)), t), "levels must be answered in order");
        List<Integer> wrong = new ArrayList<>(seq.subList(0, start + 1));
        wrong.set(0, (wrong.get(0) + 1) % 4);
        d.input("B", j("level", 2, "keys", wrong), t + 500);
        assertEquals("A", d.winner());
        assertEquals("slipped", d.reason());
    }

    @Test
    void quickDrawEarlyTapIsAFoul() {
        Duel d = duel(Duel.Kind.DRAW);
        long signal = (long) d.setup().get("signalAt");
        assertTrue(signal > d.startsAt);
        d.input("A", j("tap", true), signal - 50);
        assertEquals("B", d.winner());
        assertEquals("foul", d.reason());
        Duel e = duel(Duel.Kind.DRAW);
        e.input("B", j("tap", true), signal + 300);
        e.input("A", j("tap", true), signal + 310);
        assertEquals("B", e.winner());
    }

    @Test
    void timeoutGoesToTheLeaderOrIsADraw() {
        Duel d = duel(Duel.Kind.TUG);
        d.input("B", j("taps", 2), d.startsAt + 100);
        d.tick(d.endsAt);
        assertEquals("B", d.winner());
        Duel e = duel(Duel.Kind.DRAW);
        e.tick(e.endsAt);
        assertTrue(e.isDraw());
    }
}
