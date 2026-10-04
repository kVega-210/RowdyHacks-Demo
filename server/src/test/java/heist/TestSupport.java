package heist;

import heist.config.Balance;
import heist.game.Content;
import heist.game.GameEngine;
import heist.game.ModuleCatalog;
import heist.game.Outbox;
import heist.keys.KeySigner;
import heist.util.Paths;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/** Shared fixtures: real balance/content from the repo, a capturing outbox. */
public final class TestSupport {
    private TestSupport() {}

    public static final Path ROOT = Paths.root();
    public static final Balance BALANCE = Balance.load(ROOT);
    public static final Content CONTENT = new Content(ROOT);
    public static final List<ModuleCatalog.Info> CATALOG = ModuleCatalog.scan(ROOT.resolve("client/minigames"), "/minigames/");
    public static final KeySigner SIGNER = new KeySigner("test-secret");

    /** Records every message by recipient ("*" = all, "host" = hosts, else player id). */
    public static final class Capture implements Outbox {
        public final List<Map.Entry<String, Map<String, Object>>> log = new CopyOnWriteArrayList<>();

        @Override
        public void toPlayer(String playerId, Map<String, Object> msg) {
            log.add(Map.entry(playerId, msg));
        }

        @Override
        public void toHosts(Map<String, Object> msg) {
            log.add(Map.entry("host", msg));
        }

        @Override
        public void toAll(Map<String, Object> msg) {
            log.add(Map.entry("*", msg));
        }

        public List<Map<String, Object>> of(String type) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (var e : log) if (type.equals(e.getValue().get("t"))) out.add(e.getValue());
            return out;
        }

        public List<Map<String, Object>> to(String who, String type) {
            List<Map<String, Object>> out = new ArrayList<>();
            for (var e : log) if (who.equals(e.getKey()) && type.equals(e.getValue().get("t"))) out.add(e.getValue());
            return out;
        }

        public Map<String, Object> last(String who, String type) {
            List<Map<String, Object>> l = to(who, type);
            return l.isEmpty() ? null : l.get(l.size() - 1);
        }
    }

    public static GameEngine engine(Capture out, long seed) {
        GameEngine.Settings s = new GameEngine.Settings();
        s.seed = seed;
        return new GameEngine("TEST", BALANCE, out, null, CATALOG, CONTENT, SIGNER, s);
    }
}
