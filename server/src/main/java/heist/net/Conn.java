package heist.net;

import io.javalin.websocket.WsContext;
import heist.util.Json;

import java.util.Map;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * One WebSocket connection. Sends are queued and drained on a virtual thread so a slow phone on bad
 * venue Wi-Fi can never stall the room lock that produced the message.
 */
public final class Conn {
    private static final ExecutorService SENDERS = Executors.newVirtualThreadPerTaskExecutor();
    private static final int MAX_QUEUE = 500;

    public final WsContext ctx;
    public final String id;
    public volatile String role;
    public volatile String roomCode;
    public volatile String playerId;
    public volatile long lastSeen = System.currentTimeMillis();
    public final RateLimiter intents;
    public final RateLimiter scans;

    private final ConcurrentLinkedQueue<String> queue = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean draining = new AtomicBoolean();
    private volatile boolean closed;

    public Conn(WsContext ctx, double intentsPerSecond, double scansPerSecond) {
        this.ctx = ctx;
        this.id = ctx == null ? "test" : ctx.sessionId();
        this.intents = new RateLimiter(intentsPerSecond, intentsPerSecond * 2);
        this.scans = new RateLimiter(scansPerSecond, scansPerSecond);
    }

    public void send(Map<String, Object> msg) {
        String text = Json.write(msg);
        PayloadMeter.GLOBAL.sent(String.valueOf(msg.get("t")), text.length());
        sendRaw(text);
    }

    public void sendRaw(String text) {
        if (closed || ctx == null) return;
        if (queue.size() > MAX_QUEUE) {
            close(1013, "send queue overflow");
            return;
        }
        queue.add(text);
        if (draining.compareAndSet(false, true)) SENDERS.submit(this::drain);
    }

    private void drain() {
        do {
            String next;
            while ((next = queue.poll()) != null) {
                if (closed) {
                    queue.clear();
                    break;
                }
                try {
                    ctx.send(next);
                } catch (Exception e) {
                    closed = true;
                    queue.clear();
                }
            }
            draining.set(false);
        } while (!closed && !queue.isEmpty() && draining.compareAndSet(false, true));
    }

    public boolean isClosed() {
        return closed;
    }

    public void markClosed() {
        closed = true;
    }

    public void close(int code, String reason) {
        closed = true;
        try {
            if (ctx != null) ctx.closeSession(code, reason);
        } catch (Exception ignored) {
            // already gone
        }
    }
}
