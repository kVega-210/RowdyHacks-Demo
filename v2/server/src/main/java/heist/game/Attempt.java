package heist.game;

import java.util.List;

/** One minigame attempt handed to one player (minigame_assign). */
public record Attempt(
        String id,
        String gameId,
        int difficulty,
        double speed,
        long seed,
        long issuedAt,
        List<ModifierSpec> modifiers,
        boolean duel) {
}
