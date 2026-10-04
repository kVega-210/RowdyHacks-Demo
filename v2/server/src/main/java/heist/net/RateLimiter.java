package heist.net;

/** Token bucket. Not thread safe; each connection owns its own. */
public final class RateLimiter {
    private final double perSecond;
    private final double burst;
    private double tokens;
    private long last;

    public RateLimiter(double perSecond, double burst) {
        this.perSecond = perSecond;
        this.burst = burst;
        this.tokens = burst;
        this.last = System.nanoTime();
    }

    public synchronized boolean allow() {
        long now = System.nanoTime();
        tokens = Math.min(burst, tokens + (now - last) / 1e9 * perSecond);
        last = now;
        if (tokens < 1) return false;
        tokens -= 1;
        return true;
    }
}
