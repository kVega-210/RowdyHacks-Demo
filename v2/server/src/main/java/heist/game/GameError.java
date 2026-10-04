package heist.game;

/** A rejected intent. {@code code} is one of the error codes in /docs/protocol.md. */
public final class GameError extends RuntimeException {
    public final String code;

    public GameError(String code, String message) {
        super(message);
        this.code = code;
    }
}
