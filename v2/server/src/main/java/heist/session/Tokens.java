package heist.session;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * BE-02 session tokens. Issued on join and stored by the phone; presenting it on reconnect resumes the
 * same player (wallet, stash, key and current attempt intact) for the life of the room.
 */
public final class Tokens {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final Map<String, String> tokenToPlayer = new ConcurrentHashMap<>();

    public static String fresh() {
        byte[] b = new byte[18];
        RANDOM.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public String issue(String playerId) {
        String t = fresh();
        tokenToPlayer.put(t, playerId);
        return t;
    }

    public String playerFor(String token) {
        return token == null ? null : tokenToPlayer.get(token);
    }

    public void revokePlayer(String playerId) {
        tokenToPlayer.values().removeIf(playerId::equals);
    }
}
