package heist.game;

/** BE-03 phases. Order: LOBBY, BRIEFING, PLAY, RESULTS, BETWEEN, (repeat), ESCAPE, END. */
public enum Phase {
    LOBBY, BRIEFING, PLAY, RESULTS, BETWEEN, ESCAPE, END;

    public String wire() {
        return name().toLowerCase();
    }
}
