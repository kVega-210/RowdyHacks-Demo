package heist.db;

import heist.util.Json;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Fallback sink: one JSON object per line in data/events/{room}.jsonl. */
public final class JsonlSink implements EventWriter.Sink {
    private final Path dir;

    public JsonlSink(Path dir) {
        this.dir = dir;
    }

    public Path dir() {
        return dir;
    }

    @Override
    public void write(List<EventWriter.Row> batch) throws IOException {
        Files.createDirectories(dir);
        Map<String, StringBuilder> byRoom = new LinkedHashMap<>();
        for (EventWriter.Row r : batch) {
            String line = "{\"ts\":\"" + r.ts() + "\",\"room\":" + Json.write(r.room()) + ",\"round\":" + r.round()
                    + ",\"player\":" + Json.write(r.player()) + ",\"type\":" + Json.write(r.type())
                    + ",\"payload\":" + r.payloadJson() + "}\n";
            byRoom.computeIfAbsent(safe(r.room()), k -> new StringBuilder()).append(line);
        }
        for (var e : byRoom.entrySet()) {
            Files.writeString(dir.resolve(e.getKey() + ".jsonl"), e.getValue(), StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        }
    }

    static String safe(String room) {
        return room == null ? "_none" : room.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    @Override
    public String name() {
        return "jsonl:" + dir;
    }
}
