package heist.game;

import heist.config.Balance;

import java.util.Map;

/**
 * BE-11: one Sabotage per player per round, chosen between rounds (target + modifier). Validated here and
 * queued on the target. v2: each queued sabotage hits exactly one minigame, never two of a player's
 * minigames in a row, and a player hit last round cannot be targeted in the next break.
 */
public final class Sabotage {
    private Sabotage() {}

    public static ModifierSpec validate(Balance b, Phase phase, int nextRound, PlayerState from, PlayerState target,
                                        String modifier, Map<String, PlayerState> players) {
        if (phase != Phase.BETWEEN) throw new GameError("wrong_phase", "Sabotage is chosen between rounds");
        if (nextRound < b.i("sabotage.fromRound")) throw new GameError("too_early", "Sabotage unlocks in round " + b.i("sabotage.fromRound"));
        if (from.sabotageUsed) throw new GameError("sabotage_used", "One sabotage per round");
        if (target == null || !players.containsKey(target.id)) throw new GameError("bad_target", "Unknown target");
        if (target.id.equals(from.id)) throw new GameError("bad_target", "You cannot sabotage yourself");
        if (immune(target, nextRound - 1)) throw new GameError("target_cooldown", target.name + " was just hit. Pick someone else");
        if (!b.strings("sabotage.modifiers").contains(modifier)) throw new GameError("bad_modifier", "Unknown modifier");
        return new ModifierSpec(modifier, b.l("sabotage.durationMs"), b.d("sabotage.strength"), from.id);
    }

    /** v2: a player who was hit during the round just played cannot be picked again right away. */
    public static boolean immune(PlayerState target, int roundJustPlayed) {
        return roundJustPlayed > 0 && target.lastHitRound == roundJustPlayed;
    }
}
