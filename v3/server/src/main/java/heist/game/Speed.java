package heist.game;

import heist.config.Balance;

/** BE-04 speed ramp: base x perRound^(round-1), capped, then stacked with per-player modifiers. */
public final class Speed {
    private Speed() {}

    public static double forRound(Balance b, int round) {
        double s = b.d("speed.base") * Math.pow(b.d("speed.perRound"), Math.max(0, round - 1));
        return round3(Math.min(s, b.d("speed.max")));
    }

    /** Stack an extra multiplier on top of the round speed (capped). */
    public static double stack(Balance b, double roundSpeed, double extraMult) {
        return round3(Math.min(roundSpeed * extraMult, b.d("speed.max")));
    }

    static double round3(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
