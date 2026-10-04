package heist.game;

import heist.config.Balance;

import java.util.List;

/** BE-10 Hack vs Break-in (plus Rival Heist, MG-45) round configuration from balance.json. */
public final class RoundTypes {
    private RoundTypes() {}

    public record RoundType(String id, boolean steal, double payoutMult, List<String> tags, String banner) {
    }

    public static RoundType get(Balance b, String id) {
        String base = "roundTypes." + id;
        return new RoundType(id, b.b(base + ".steal"), b.d(base + ".payoutMult"), b.strings(base + ".tags"), b.s(base + ".banner"));
    }

    /** Round type for a 1-based round; the sequence repeats if there are more rounds than entries. */
    public static RoundType forRound(Balance b, int round, int players) {
        List<String> seq = b.strings("roundTypes.sequence");
        String id = seq.get((round - 1) % seq.size());
        if ("rival".equals(id) && players < 2) id = "breakin";
        return get(b, id);
    }
}
