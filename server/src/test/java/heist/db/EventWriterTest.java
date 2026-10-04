package heist.db;

import heist.util.Json;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EventWriterTest {
    @Test
    void writesJsonlBatches() throws Exception {
        Path dir = Files.createTempDirectory("ev");
        try (EventWriter w = new EventWriter(new JsonlSink(dir))) {
            for (int i = 0; i < 500; i++) w.log("ROOM", 1, "p1", "minigame_result", Json.obj("success", true, "delta", 100, "wallet", i));
            w.flush();
            List<String> lines = Files.readAllLines(dir.resolve("ROOM.jsonl"));
            assertEquals(500, lines.size());
            assertEquals(500L, w.stats().get("written"));
            var events = EventStore.jsonl(dir).events("ROOM");
            assertEquals("minigame_result", events.get(0).path("type").asText());
        }
    }

    /** DB-02: a slow or dead database must never block gameplay. */
    @Test
    void failingOrSlowSinkNeverBlocksLog() throws Exception {
        CountDownLatch never = new CountDownLatch(1);
        EventWriter.Sink stuck = new EventWriter.Sink() {
            @Override
            public void write(List<EventWriter.Row> batch) throws Exception {
                never.await();
            }

            @Override
            public String name() {
                return "stuck";
            }
        };
        EventWriter w = new EventWriter(stuck);
        long t0 = System.nanoTime();
        for (int i = 0; i < 50_000; i++) w.log("R", 0, null, "x", Json.obj("i", i));
        long ms = (System.nanoTime() - t0) / 1_000_000;
        assertTrue(ms < 2000, "50k logs took " + ms + "ms with a stuck sink");
        assertTrue((Long) w.stats().get("dropped") > 0, "overflow is dropped, not blocking");
        never.countDown();

        EventWriter failing = new EventWriter(new EventWriter.Sink() {
            @Override
            public void write(List<EventWriter.Row> batch) {
                throw new IllegalStateException("db down");
            }

            @Override
            public String name() {
                return "down";
            }
        });
        failing.log("R", 0, null, "x", Json.obj());
        failing.flush();
        assertEquals(1L, failing.stats().get("dropped"));
        failing.close();
    }

    @Test
    void databaseUrlParsing() {
        String[] p = JdbcSink.toJdbc("postgres://tsdbadmin:p%40ss@abc.tsdb.cloud.timescale.com:34567/tsdb?sslmode=require");
        assertEquals("jdbc:postgresql://abc.tsdb.cloud.timescale.com:34567/tsdb?sslmode=require", p[0]);
        assertEquals("tsdbadmin", p[1]);
        assertEquals("p@ss", p[2]);
    }
}
