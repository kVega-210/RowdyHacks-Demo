package heist.game;

import heist.TestSupport;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Static lint for DOC-03: every minigame/modifier/wager module declares parseable meta, ids are unique and match
 * file names, nothing touches storage or loads external assets, and every minigame has a fail caption.
 */
class ModuleContractTest {
    private static final Path ROOT = TestSupport.ROOT;

    @Test
    void thirtySixMinigamesWithValidMeta() throws Exception {
        List<ModuleCatalog.Info> games = TestSupport.CATALOG;
        assertEquals(36, games.size(), "36 minigames in /client/minigames");
        Set<String> ids = new HashSet<>();
        String captions = Files.readString(ROOT.resolve("content/fail-lines.json"));
        for (ModuleCatalog.Info g : games) {
            assertTrue(ids.add(g.id()), "duplicate id " + g.id());
            assertEquals("/minigames/" + g.id() + ".js", g.file(), "id must match file name");
            assertFalse(g.tags().isEmpty(), g.id() + " needs tags");
            assertTrue(g.hasTag("cyber") || g.hasTag("classic"), g.id() + " must be cyber or classic so round types can pick it");
            assertTrue(g.baseDurationMs() > 0 && g.baseDurationMs() <= 15000, g.id() + " baseDurationMs");
            assertTrue(captions.contains("\"" + g.id() + "\""), g.id() + " needs a caption in fail-lines.json");
            String src = Files.readString(ROOT.resolve("client/minigames/" + g.id() + ".js"));
            assertTrue(src.contains("export function mount("), g.id() + " exports mount");
            if (g.hasTag("choice")) assertTrue(src.contains("wager"), g.id() + " choice games report wager");
            if (g.hasTag("push-luck")) assertTrue(src.contains("hh-stake"), g.id() + " shows the cash at stake");
        }
    }

    @Test
    void noStorageNoExternalAssets() throws Exception {
        for (String dir : List.of("client/minigames", "client/modifiers", "client/wagers", "client/fx")) {
            try (Stream<Path> files = Files.list(ROOT.resolve(dir))) {
                for (Path f : files.filter(p -> p.toString().endsWith(".js")).toList()) {
                    String src = Files.readString(f);
                    assertFalse(src.contains("localStorage") || src.contains("sessionStorage") || src.contains("indexedDB"), f + " uses storage");
                    assertFalse(src.matches("(?s).*['\"`]https?://.*"), f + " references an external URL");
                }
            }
        }
    }

    @Test
    void modifiersMatchBalanceAndWrappersAreGone() {
        var mods = ModuleCatalog.scan(ROOT.resolve("client/modifiers"), "/modifiers/");
        assertEquals(Set.copyOf(TestSupport.BALANCE.strings("sabotage.modifiers")), Set.copyOf(mods.stream().map(ModuleCatalog.Info::id).toList()));
        assertEquals(Set.of("false-alarm", "jam-the-signal", "screen-jitter", "shrunken-buttons"), Set.copyOf(mods.stream().map(ModuleCatalog.Info::id).toList()));
        assertTrue(ModuleCatalog.scan(ROOT.resolve("client/wagers"), "/wagers/").isEmpty(), "v2 has no wager wrappers");
        assertFalse(TestSupport.BALANCE.has("wager.wrappers"));
    }

    @Test
    void underscoreFilesAreSkipped() {
        assertTrue(ModuleCatalog.scan(ROOT.resolve("client/modifiers"), "/m/").stream().noneMatch(i -> i.id().startsWith("_")));
    }
}
