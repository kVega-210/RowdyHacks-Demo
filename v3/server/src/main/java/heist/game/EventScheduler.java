package heist.game;

import heist.config.Balance;
import heist.util.Rng;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * BE-06: plan the Freeze window for one round, ahead of time and from the seeded RNG.
 * v2: no Steal windows or Bank Raids; at most one Freeze per round, always preceded by a warning. Guarantees: none starts before noneInFirstMs, every window ends before the last
 * noneInLastMs of play, and there is at least minGapMs between one window ending and the next starting.
 */
public final class EventScheduler {
    private EventScheduler() {}

    public enum Kind { FREEZE }

    public record Scheduled(Kind kind, long atMs, long durationMs) {
        public long endMs() {
            return atMs + durationMs;
        }
    }

    public static long duration(Balance b, Kind k) {
        return switch (k) {
            case FREEZE -> b.l("freeze.windowMs");
        };
    }

    public static List<Scheduled> plan(Balance b, Rng rng, long playMs) {
        List<Kind> kinds = new ArrayList<>();
        if (rng.chance(b.d("freeze.chancePerRound"))) kinds.add(Kind.FREEZE);
        kinds = rng.shuffled(kinds);

        long first = Math.max(b.l("events.noneInFirstMs"), b.l("freeze.warningMs"));
        long lastEnd = playMs - b.l("events.noneInLastMs");
        long gap = b.l("events.minGapMs");

        // Place windows left to right, spreading the slack randomly between them.
        long need = 0;
        for (Kind k : kinds) need += duration(b, k);
        need += gap * Math.max(0, kinds.size() - 1);
        while (!kinds.isEmpty() && first + need > lastEnd) {
            Kind dropped = kinds.remove(kinds.size() - 1);
            need -= duration(b, dropped) + (kinds.isEmpty() ? 0 : gap);
        }
        List<Scheduled> out = new ArrayList<>();
        long slack = Math.max(0, lastEnd - first - need);
        long cursor = first;
        for (Kind k : kinds) {
            long shift = slack > 0 ? rng.range(0L, slack) : 0;
            shift = Math.min(shift, slack);
            slack -= shift;
            cursor += shift;
            out.add(new Scheduled(k, cursor, duration(b, k)));
            cursor += duration(b, k) + gap;
        }
        out.sort(Comparator.comparingLong(Scheduled::atMs));
        return out;
    }
}
