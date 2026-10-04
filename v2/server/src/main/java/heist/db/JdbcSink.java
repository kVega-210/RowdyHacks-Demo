package heist.db;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.List;

/** Postgres / Tiger Data sink. Batched INSERTs into the DB-01 hypertable; runs schema.sql on startup. */
public final class JdbcSink implements EventWriter.Sink {
    private final String url;
    private final String user;
    private final String password;
    private Connection conn;

    public JdbcSink(String databaseUrl, Path schemaSql) throws Exception {
        String[] parsed = toJdbc(databaseUrl);
        this.url = parsed[0];
        this.user = parsed[1];
        this.password = parsed[2];
        try (Connection c = open(); Statement st = c.createStatement()) {
            if (schemaSql != null && Files.exists(schemaSql)) st.execute(Files.readString(schemaSql));
        }
    }

    /** Accepts postgres://user:pass@host:port/db?sslmode=require as well as jdbc:postgresql://... URLs. */
    public static String[] toJdbc(String databaseUrl) {
        if (databaseUrl.startsWith("jdbc:")) return new String[]{databaseUrl, null, null};
        URI u = URI.create(databaseUrl.replaceFirst("^postgres(ql)?://", "http://"));
        String user = null, pass = null;
        if (u.getRawUserInfo() != null) {
            String[] up = u.getRawUserInfo().split(":", 2);
            user = java.net.URLDecoder.decode(up[0], java.nio.charset.StandardCharsets.UTF_8);
            if (up.length > 1) pass = java.net.URLDecoder.decode(up[1], java.nio.charset.StandardCharsets.UTF_8);
        }
        String jdbc = "jdbc:postgresql://" + u.getHost() + (u.getPort() > 0 ? ":" + u.getPort() : "") + u.getRawPath()
                + (u.getRawQuery() != null ? "?" + u.getRawQuery() : "");
        return new String[]{jdbc, user, pass};
    }

    private Connection open() throws Exception {
        return user == null ? DriverManager.getConnection(url) : DriverManager.getConnection(url, user, password);
    }

    public Connection connection() throws Exception {
        if (conn == null || conn.isClosed() || !conn.isValid(2)) conn = open();
        return conn;
    }

    @Override
    public void write(List<EventWriter.Row> batch) throws Exception {
        Connection c = connection();
        try (PreparedStatement ps = c.prepareStatement(
                "INSERT INTO events (ts, room_id, round, player_id, event_type, payload) VALUES (?, ?, ?, ?, ?, ?::jsonb)")) {
            for (EventWriter.Row r : batch) {
                ps.setTimestamp(1, Timestamp.from(r.ts()));
                ps.setString(2, r.room() == null ? "_none" : r.room());
                ps.setInt(3, r.round());
                ps.setString(4, r.player());
                ps.setString(5, r.type());
                ps.setString(6, r.payloadJson());
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (Exception e) {
            try {
                c.close();
            } catch (Exception ignored) {
                // reconnect next time
            }
            conn = null;
            throw e;
        }
    }

    @Override
    public String name() {
        return "jdbc";
    }

    @Override
    public void close() {
        try {
            if (conn != null) conn.close();
        } catch (Exception ignored) {
            // shutting down
        }
    }
}
