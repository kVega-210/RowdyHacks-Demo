package heist.game;

import com.fasterxml.jackson.databind.JsonNode;
import heist.config.Balance;
import heist.util.Json;
import heist.util.Rng;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * v3 live rival duel between two players (a and b). The server is the referee: both phones stream their inputs
 * ({@code duel_input}), the server updates the shared state, broadcasts it, and decides the winner.
 * Four games:
 * <ul>
 *   <li>TUG  - Tug of War: every tap pulls the rope your way; first to drag it {@code target} taps over the line wins.</li>
 *   <li>TYPE - Type Race: both type the same password on a keypad; first to submit it correctly wins.</li>
 *   <li>MEMORY - Memory Duel: Simon-style sequence that grows each level; first to get one wrong loses.</li>
 *   <li>DRAW - Quick Draw: wait for "DRAW!", then tap; tapping early is a foul; first valid tap wins.</li>
 * </ul>
 * Timeline: created at {@code now}, a 3-2-1 countdown until {@code startsAt}, play until {@code endsAt} (timeout
 * decides by progress, or a draw).
 */
public final class Duel {
    public enum Kind {
        TUG("tug-of-war", "Tug of War"), TYPE("type-race", "Type Race"), MEMORY("memory-duel", "Memory Duel"), DRAW("quick-draw", "Quick Draw");

        public final String id;
        public final String title;

        Kind(String id, String title) {
            this.id = id;
            this.title = title;
        }

        public static Kind of(String id) {
            for (Kind k : values()) if (k.id.equals(id)) return k;
            throw new IllegalArgumentException("unknown duel " + id);
        }
    }

    public static final String KEYPAD = "ABCDEFHKMNPRSTXZ"; // 16 easy-to-tell-apart letters for Type Race

    public final String id;
    public final Kind kind;
    public final String a;
    public final String b;
    public final boolean event;
    public final long startsAt;
    public final long endsAt;

    // Tug of War: rope > 0 means a is winning.
    final int target;
    int rope;
    private long lastTapA = -1, lastTapB = -1;
    // Type Race
    final String word;
    int progA, progB;
    // Memory Duel: levelX = levels completed.
    final List<Integer> seq = new ArrayList<>();
    final int startLen;
    final int maxLevel;
    int levelA, levelB;
    // Quick Draw
    final long signalAt;
    String foul;

    String winner;
    boolean draw;
    String reason;
    boolean dirty = true;
    long lastSentAt = -1;

    public Duel(String id, Kind kind, String a, String b, boolean event, long now, Balance bal, Rng rng) {
        this.id = id;
        this.kind = kind;
        this.a = a;
        this.b = b;
        this.event = event;
        String k = "rival.games." + kind.id;
        this.startsAt = now + bal.l("rival.countdownMs");
        this.endsAt = startsAt + bal.l(k + ".durationMs");
        this.target = kind == Kind.TUG ? bal.i(k + ".target") : 0;
        StringBuilder w = new StringBuilder();
        if (kind == Kind.TYPE) for (int i = 0; i < bal.i(k + ".length"); i++) w.append(KEYPAD.charAt(rng.nextInt(KEYPAD.length())));
        this.word = w.toString();
        this.startLen = kind == Kind.MEMORY ? bal.i(k + ".startLength") : 0;
        this.maxLevel = kind == Kind.MEMORY ? bal.i(k + ".maxLevel") : 0;
        if (kind == Kind.MEMORY) {
            int prev = -1;
            for (int i = 0; i < startLen + maxLevel; i++) {
                int pad;
                do pad = rng.nextInt(4); while (pad == prev); // never the same pad twice in a row
                seq.add(pad);
                prev = pad;
            }
        }
        this.signalAt = kind == Kind.DRAW ? startsAt + rng.range(bal.l(k + ".signalMinMs"), bal.l(k + ".signalMaxMs")) : -1;
    }

    public boolean over() {
        return winner != null || draw;
    }

    public boolean has(String pid) {
        return a.equals(pid) || b.equals(pid);
    }

    public String opponent(String pid) {
        return a.equals(pid) ? b : a;
    }

    public String winner() {
        return winner;
    }

    public boolean isDraw() {
        return draw;
    }

    public String reason() {
        return reason;
    }

    /** Per-game data both phones need at the start (same for both). */
    public Map<String, Object> setup() {
        return switch (kind) {
            case TUG -> Json.obj("target", target);
            case TYPE -> Json.obj("word", word, "keys", KEYPAD);
            case MEMORY -> Json.obj("seq", seq, "startLength", startLen, "maxLevel", maxLevel);
            case DRAW -> Json.obj("signalAt", signalAt);
        };
    }

    /** Live state, from a's side; phones flip it if they are b. "bar" is -1..1 (positive = a ahead) for the host. */
    public Map<String, Object> state() {
        double bar = switch (kind) {
            case TUG -> (double) rope / Math.max(1, target);
            case TYPE -> word.isEmpty() ? 0 : (double) (progA - progB) / word.length();
            case MEMORY -> maxLevel == 0 ? 0 : (double) (levelA - levelB) / maxLevel;
            case DRAW -> 0;
        };
        return Json.msg("duel_state", "duelId", id, "rope", kind == Kind.TUG ? rope : null,
                "a", Json.obj("progress", kind == Kind.TYPE ? progA : null, "level", kind == Kind.MEMORY ? levelA : null),
                "b", Json.obj("progress", kind == Kind.TYPE ? progB : null, "level", kind == Kind.MEMORY ? levelB : null),
                "bar", Math.max(-1, Math.min(1, bar)));
    }

    /** Apply one input from a player. Returns true if anything changed. Inputs before the countdown ends are ignored
     *  (except Quick Draw, where tapping before the signal is a foul). */
    public boolean input(String pid, JsonNode in, long now) {
        if (over() || !has(pid) || now > endsAt + 300) return false;
        boolean isA = a.equals(pid);
        switch (kind) {
            case TUG -> {
                if (now < startsAt) return false;
                // Taps are batched by the phone (~every 100ms). Cap the batch by the time since the last batch so a
                // modified client can't pull faster than ~20 taps a second.
                long last = isA ? lastTapA : lastTapB;
                int cap = last < 0 ? 3 : (int) Math.max(1, Math.min(4, (now - last) / 50));
                int taps = (int) Math.max(0, Math.min(cap, in.path("taps").asInt(0)));
                if (taps == 0) return false;
                if (isA) lastTapA = now; else lastTapB = now;
                rope += isA ? taps : -taps;
                if (rope >= target) win(a, "pulled");
                else if (rope <= -target) win(b, "pulled");
                return changed();
            }
            case TYPE -> {
                if (now < startsAt) return false;
                if (in.has("done")) {
                    if (word.equalsIgnoreCase(in.path("done").asText(""))) {
                        if (isA) progA = word.length(); else progB = word.length();
                        win(pid, "typed");
                    }
                    return changed();
                }
                int p = Math.max(0, Math.min(word.length() - 1, in.path("progress").asInt(0)));
                if (isA) progA = p; else progB = p;
                return changed();
            }
            case MEMORY -> {
                if (now < startsAt) return false;
                int level = in.path("level").asInt(-1);
                int done = isA ? levelA : levelB;
                if (level != done + 1) return false; // must answer the next level, in order
                JsonNode keys = in.path("keys");
                int len = startLen + level - 1;
                boolean ok = keys.isArray() && keys.size() == len;
                for (int i = 0; ok && i < len; i++) ok = keys.get(i).asInt(-1) == seq.get(i);
                if (!ok) {
                    win(opponent(pid), "slipped");
                    return changed();
                }
                if (isA) levelA = level; else levelB = level;
                if (level >= maxLevel) win(pid, "perfect memory");
                return changed();
            }
            case DRAW -> {
                if (!in.path("tap").asBoolean(false)) return false;
                if (now < signalAt) {
                    foul = pid;
                    win(opponent(pid), "foul");
                } else {
                    win(pid, "fastest draw");
                }
                return changed();
            }
            default -> {
                return false;
            }
        }
    }

    /** Timeout: decide by progress (or a draw when level). */
    public boolean tick(long now) {
        if (over() || now < endsAt) return false;
        int lead = switch (kind) {
            case TUG -> rope;
            case TYPE -> progA - progB;
            case MEMORY -> levelA - levelB;
            case DRAW -> 0;
        };
        if (lead > 0) win(a, "time");
        else if (lead < 0) win(b, "time");
        else {
            draw = true;
            reason = "time";
        }
        return changed();
    }

    /** Opponent left: the one still here wins. */
    public void forfeit(String quitter) {
        if (over() || !has(quitter)) return;
        win(opponent(quitter), "forfeit");
    }

    private void win(String who, String why) {
        if (over()) return;
        winner = who;
        reason = why;
    }

    private boolean changed() {
        dirty = true;
        return true;
    }
}
