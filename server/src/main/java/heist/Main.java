package heist;

import java.util.Arrays;

/**
 * Entry point. {@code java -jar heist-server.jar [command] [args]}
 * <ul>
 *   <li>(none) or {@code serve}: run the game server</li>
 *   <li>{@code bots}: spawn protocol bots against a server (TL-01)</li>
 *   <li>{@code smoke}: full in-process game with bots and assertions (IF-04)</li>
 *   <li>{@code keys}: generate signed key tags and the print sheet (PH-01)</li>
 *   <li>{@code gen-voice}: batch-generate narrator audio with ElevenLabs (AU-02)</li>
 * </ul>
 */
public final class Main {
    private Main() {}

    public static void main(String[] args) throws Exception {
        String cmd = args.length == 0 ? "serve" : args[0];
        String[] rest = args.length == 0 ? args : Arrays.copyOfRange(args, 1, args.length);
        switch (cmd) {
            case "serve" -> {
                HeistServer.Options o = new HeistServer.Options();
                String scale = System.getenv("HEIST_TIME_SCALE");
                if (scale != null && !scale.isBlank()) {
                    o.timeScale = Double.parseDouble(scale);
                    o.clock = heist.util.Clock.scaled(o.timeScale);
                }
                HeistServer s = new HeistServer(o).start();
                Runtime.getRuntime().addShutdownHook(new Thread(s::stop));
            }
            case "bots" -> heist.tools.Bots.main(rest);
            case "smoke" -> heist.tools.Smoke.main(rest);
            case "keys" -> heist.keys.KeyGen.main(rest);
            case "gen-voice" -> heist.tools.GenVoice.main(rest);
            default -> {
                System.err.println("Unknown command " + cmd + ". Use serve | bots | smoke | keys | gen-voice");
                System.exit(2);
            }
        }
    }
}
