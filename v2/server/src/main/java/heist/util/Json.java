package heist.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.LinkedHashMap;
import java.util.Map;

/** Shared Jackson mapper and tiny helpers for building protocol messages. */
public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper()
            .disable(SerializationFeature.FAIL_ON_EMPTY_BEANS);

    private Json() {}

    /** Build an ordered map from alternating key/value pairs. Null values are skipped. */
    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            if (kv[i + 1] != null) m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    /** A protocol message: {"t": type, ...}. */
    public static Map<String, Object> msg(String type, Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("t", type);
        m.putAll(obj(kv));
        return m;
    }

    public static String write(Object o) {
        try {
            return MAPPER.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static JsonNode read(String s) {
        try {
            return MAPPER.readTree(s);
        } catch (Exception e) {
            return null;
        }
    }

    public static ObjectNode node() {
        return MAPPER.createObjectNode();
    }

    public static String str(JsonNode n, String field, String def) {
        if (n == null) return def;
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? def : v.asText(def);
    }

    public static long lng(JsonNode n, String field, long def) {
        if (n == null) return def;
        JsonNode v = n.get(field);
        return v == null || !v.isNumber() ? def : v.asLong();
    }

    public static double dbl(JsonNode n, String field, double def) {
        if (n == null) return def;
        JsonNode v = n.get(field);
        return v == null || !v.isNumber() ? def : v.asDouble();
    }

    public static boolean bool(JsonNode n, String field, boolean def) {
        if (n == null) return def;
        JsonNode v = n.get(field);
        return v == null || !v.isBoolean() ? def : v.asBoolean();
    }
}
