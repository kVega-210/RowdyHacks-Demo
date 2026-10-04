package heist.net;

import heist.util.Json;

import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

/** IF-03: per message-type byte counters so we can watch the payload budget (target: typical < 1KB). */
public final class PayloadMeter {
    public static final PayloadMeter GLOBAL = new PayloadMeter();

    private static final class Stat {
        final LongAdder count = new LongAdder();
        final LongAdder bytes = new LongAdder();
        volatile long max;
    }

    private final Map<String, Stat> out = new ConcurrentHashMap<>();
    private final Map<String, Stat> in = new ConcurrentHashMap<>();

    public void sent(String type, int bytes) {
        record(out, type, bytes);
    }

    public void received(String type, int bytes) {
        record(in, type, bytes);
    }

    private static void record(Map<String, Stat> m, String type, int bytes) {
        Stat s = m.computeIfAbsent(type == null ? "?" : type, k -> new Stat());
        s.count.increment();
        s.bytes.add(bytes);
        if (bytes > s.max) s.max = bytes;
    }

    public Map<String, Object> snapshot() {
        return Json.obj("out", table(out), "in", table(in));
    }

    private static Map<String, Object> table(Map<String, Stat> m) {
        Map<String, Object> t = new TreeMap<>();
        m.forEach((k, s) -> {
            long c = s.count.sum();
            t.put(k, Json.obj("count", c, "avg", c == 0 ? 0 : s.bytes.sum() / c, "max", s.max));
        });
        return t;
    }
}
