package heist.game;

import heist.config.Balance;

/**
 * BE-03 phase graph as a pure function. lobby -> briefing -> play -> results -> between -> briefing ...
 * v2: the game ends (results -> end, wallets auto-banked) only when the bank is empty. Past the host's
 * round count, overtime rounds continue until then, up to a safety cap of maxRounds.
 */
public final class RoundMachine {
    private RoundMachine() {}

    public record Step(Phase phase, int round) {
    }

    public static Step next(Phase phase, int round, int maxRounds, boolean bankEmpty) {
        return switch (phase) {
            case LOBBY -> new Step(Phase.BRIEFING, 1);
            case BRIEFING -> new Step(Phase.PLAY, round);
            case PLAY -> new Step(Phase.RESULTS, round);
            case RESULTS -> (bankEmpty || round >= maxRounds) ? new Step(Phase.END, round) : new Step(Phase.BETWEEN, round);
            case BETWEEN -> new Step(Phase.BRIEFING, round + 1);
            case ESCAPE, END -> new Step(Phase.END, round);
        };
    }

    public static long durationMs(Balance b, Phase phase) {
        return switch (phase) {
            case BRIEFING -> b.l("rounds.briefingMs");
            case PLAY -> b.l("rounds.playMs");
            case RESULTS -> b.l("rounds.resultsMs");
            case BETWEEN -> b.l("rounds.betweenMs");
            default -> 0;
        };
    }

    public static int difficulty(Balance b, int round) {
        var byRound = b.ints("difficulty.byRound");
        int idx = Math.min(Math.max(round - 1, 0), byRound.size() - 1);
        return Math.max(1, Math.min(3, byRound.get(idx)));
    }
}
