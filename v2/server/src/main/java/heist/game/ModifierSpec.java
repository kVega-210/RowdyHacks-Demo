package heist.game;

/** A sabotage modifier queued against a player: applyModifier(el,{duration,strength}). */
public record ModifierSpec(String id, long durationMs, double strength, String from) {
}
