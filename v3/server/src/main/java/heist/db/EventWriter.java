package heist.db;

import heist.util.Json;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * DB-02 event writer. {@link #log} only does a non-blocking offer onto a bounded queue; a daemon thread
 * drains it in batches into the sink. A full queue or a failing database drops events and counts them,
 * it never slows down or breaks gameplay.
 */
public final class EventWriter implements EventLog, AutoCloseable {
    public record Row(Instant ts, String room, int round, String player, String type, String payloadJson) {
    }

    /** Where batches go: Postgres/Tiger Data, or JSONL files. */
    public interface Sink extends AutoCloseable {
        void write(List<Row> batch) throws Exception;

        String name();

        @Override
        default void close() {
        }
    }

    private final Sink sink;
    private final BlockingQueue<Row> queue = new ArrayBlockingQueue<>(20_000);
    private final AtomicLong written = new AtomicLong();
    private final AtomicLong dropped = new AtomicLong();
    private final AtomicLong failedBatches = new AtomicLong();
    private final AtomicLong pending = new AtomicLong();
    private final Thread worker;
    private volatile boolean running = true;
    private final Object flushLock = new Object();

    public EventWriter(Sink sink) {
        this.sink = sink;
        this.worker = new Thread(this::loop, "event-writer");
        worker.setDaemon(true);
        worker.start();
    }

    @Override
    public void log(String roomId, int round, String playerId, String type, Map<String, Object> payload) {
        try {
            Row r = new Row(Instant.now(), roomId, round, playerId, type, Json.write(payload == null ? Map.of() : payload));
            pending.incrementAndGet();
            if (!queue.offer(r)) {
                pending.decrementAndGet();
                dropped.incrementAndGet();
            }
        } catch (Exception e) {
            dropped.incrementAndGet();
        }
    }

    private void loop() {
        List<Row> batch = new ArrayList<>(256);
        while (running || !queue.isEmpty()) {
            try {
                Row first = queue.poll(250, TimeUnit.MILLISECONDS);
                if (first == null) continue;
                batch.add(first);
                queue.drainTo(batch, 255);
                writeBatch(batch);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } finally {
                batch.clear();
            }
        }
    }

    private void writeBatch(List<Row> batch) {
        synchronized (flushLock) {
            try {
                sink.write(batch);
                written.addAndGet(batch.size());
            } catch (Exception e) {
                failedBatches.incrementAndGet();
                dropped.addAndGet(batch.size());
                System.err.println("[events] " + sink.name() + " write failed, dropped " + batch.size() + ": " + e.getMessage());
            } finally {
                pending.addAndGet(-batch.size());
            }
        }
    }

    /** Drain everything queued so far (used by tests and on shutdown). */
    public void flush() {
        List<Row> batch = new ArrayList<>();
        queue.drainTo(batch);
        if (!batch.isEmpty()) writeBatch(batch);
        long deadline = System.currentTimeMillis() + 3000;
        while (pending.get() > 0 && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(10);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    public Map<String, Object> stats() {
        return Json.obj("sink", sink.name(), "written", written.get(), "dropped", dropped.get(),
                "failedBatches", failedBatches.get(), "queued", queue.size());
    }

    @Override
    public void close() {
        running = false;
        flush();
        try {
            worker.join(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        try {
            sink.close();
        } catch (Exception ignored) {
            // best effort
        }
    }
}
