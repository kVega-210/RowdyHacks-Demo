package heist.game;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Auto-discovers client modules (minigames, modifiers, wagers) from a folder. There is no index file to
 * edit: drop a file in /client/minigames and it is live. Files starting with "_" are skipped.
 * The {@code export const meta = {...}} block is read with regexes so the server never runs client JS.
 */
public final class ModuleCatalog {
    public record Info(String id, String name, List<String> tags, long baseDurationMs, String file) {
        public boolean hasTag(String t) {
            return tags.contains(t);
        }
    }

    private static final Pattern META = Pattern.compile("export\\s+const\\s+meta\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;", Pattern.MULTILINE);
    private static final Pattern ID = Pattern.compile("\\bid\\s*:\\s*['\"]([^'\"]+)['\"]");
    private static final Pattern NAME = Pattern.compile("\\bname\\s*:\\s*['\"]([^'\"]+)['\"]");
    private static final Pattern TAGS = Pattern.compile("\\btags\\s*:\\s*\\[([^\\]]*)\\]");
    private static final Pattern DURATION = Pattern.compile("\\bbaseDurationMs\\s*:\\s*(\\d+)");

    private ModuleCatalog() {}

    public static List<Info> scan(Path dir, String urlPrefix) {
        List<Info> out = new ArrayList<>();
        if (!Files.isDirectory(dir)) return out;
        try (Stream<Path> files = Files.list(dir)) {
            files.filter(p -> p.getFileName().toString().endsWith(".js"))
                    .filter(p -> !p.getFileName().toString().startsWith("_"))
                    .sorted()
                    .forEach(p -> {
                        Info info = parse(p, urlPrefix);
                        if (info != null) out.add(info);
                    });
        } catch (Exception e) {
            throw new IllegalStateException("Cannot scan " + dir, e);
        }
        return out;
    }

    public static Info parse(Path file, String urlPrefix) {
        try {
            String src = Files.readString(file);
            Matcher m = META.matcher(src);
            if (!m.find()) return null;
            String body = m.group(1);
            String fname = file.getFileName().toString();
            String id = find(ID, body, fname.substring(0, fname.length() - 3));
            String name = find(NAME, body, id);
            List<String> tags = new ArrayList<>();
            Matcher t = TAGS.matcher(body);
            if (t.find()) {
                Arrays.stream(t.group(1).split(","))
                        .map(s -> s.trim().replaceAll("^['\"]|['\"]$", ""))
                        .filter(s -> !s.isEmpty())
                        .forEach(tags::add);
            }
            long dur = Long.parseLong(find(DURATION, body, "12000"));
            return new Info(id, name, List.copyOf(tags), dur, urlPrefix + fname);
        } catch (Exception e) {
            return null;
        }
    }

    private static String find(Pattern p, String body, String def) {
        Matcher m = p.matcher(body);
        return m.find() ? m.group(1) : def;
    }
}
