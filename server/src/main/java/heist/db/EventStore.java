package heist.db;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import heist.util.Json;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/** Read side of the event log, used by replay, stats and the roast assembler. */
public interface EventStore {
    /** Events for one room in time order: {ts, room, round, player, type, payload}. */
    List<JsonNode> events(String room) throws Exception;

    /** Room ids that have a finished game, newest first. */
    List<String> finishedRooms(int limit) throws Exception;

    static EventStore jsonl(Path dir) {
        return new EventStore() {
            @Override
            public List<JsonNode> events(String room) throws Exception {
                Path f = dir.resolve(JsonlSink.safe(room) + ".jsonl");
                List<JsonNode> out = new ArrayList<>();
                if (!Files.exists(f)) return out;
                for (String line : Files.readAllLines(f)) {
                    JsonNode n = Json.read(line);
                    if (n != null) out.add(n);
                }
                return out;
            }

            @Override
            public List<String> finishedRooms(int limit) throws Exception {
                List<String> out = new ArrayList<>();
                if (!Files.isDirectory(dir)) return out;
                try (Stream<Path> s = Files.list(dir)) {
                    s.filter(p -> p.toString().endsWith(".jsonl"))
                            .sorted((a, b) -> Long.compare(b.toFile().lastModified(), a.toFile().lastModified()))
                            .forEach(p -> {
                                String name = p.getFileName().toString();
                                out.add(name.substring(0, name.length() - 6));
                            });
                }
                return out.subList(0, Math.min(limit, out.size()));
            }
        };
    }

    static EventStore jdbc(JdbcSink sink) {
        return new EventStore() {
            @Override
            public List<JsonNode> events(String room) throws Exception {
                List<JsonNode> out = new ArrayList<>();
                try (PreparedStatement ps = sink.connection().prepareStatement(
                        "SELECT ts, room_id, round, player_id, event_type, payload::text FROM events WHERE room_id = ? ORDER BY ts")) {
                    ps.setString(1, room);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) {
                            ObjectNode n = Json.node();
                            n.put("ts", rs.getTimestamp(1).toInstant().toString());
                            n.put("room", rs.getString(2));
                            n.put("round", rs.getInt(3));
                            n.put("player", rs.getString(4));
                            n.put("type", rs.getString(5));
                            n.set("payload", Json.read(rs.getString(6)));
                            out.add(n);
                        }
                    }
                }
                return out;
            }

            @Override
            public List<String> finishedRooms(int limit) throws Exception {
                List<String> out = new ArrayList<>();
                try (PreparedStatement ps = sink.connection().prepareStatement(
                        "SELECT room_id FROM events WHERE event_type = 'game_end' ORDER BY ts DESC LIMIT ?")) {
                    ps.setInt(1, limit);
                    try (ResultSet rs = ps.executeQuery()) {
                        while (rs.next()) out.add(rs.getString(1));
                    }
                }
                return out;
            }
        };
    }
}
