package heist.util;

import java.nio.file.Files;
import java.nio.file.Path;

/** Locates the repository root (the folder holding /shared/balance.json). */
public final class Paths {
    private Paths() {}

    public static Path root() {
        String prop = System.getProperty("heist.root");
        if (prop == null || prop.isBlank()) prop = System.getenv("HEIST_ROOT");
        if (prop != null && !prop.isBlank()) return Path.of(prop).toAbsolutePath().normalize();
        Path p = Path.of("").toAbsolutePath();
        while (p != null) {
            if (Files.exists(p.resolve("shared/balance.json"))) return p;
            p = p.getParent();
        }
        throw new IllegalStateException("Cannot find repo root (shared/balance.json). Set HEIST_ROOT.");
    }
}
