package heist.keys;

import heist.game.Content;
import heist.util.Paths;

import java.nio.file.Files;
import java.nio.file.Path;

/** CLI: generate the signed key IDs and the print sheet into data/keys/ (gitignored: codes depend on the secret). */
public final class KeyGen {
    private KeyGen() {}

    public static void main(String[] args) throws Exception {
        int count = 8;
        for (int i = 0; i < args.length - 1; i++) if (args[i].equals("--count")) count = Integer.parseInt(args[i + 1]);
        Path root = Paths.root();
        KeySigner signer = KeySigner.fromEnv();
        if (System.getenv("HEIST_KEY_SECRET") == null) {
            System.out.println("WARNING: HEIST_KEY_SECRET is not set, using the public dev secret. Set it before printing real tags.");
        }
        Path out = root.resolve("data/keys");
        Files.createDirectories(out);
        StringBuilder csv = new StringBuilder("vault,code\n");
        for (int i = 1; i <= count; i++) csv.append(i).append(',').append(signer.code(i)).append('\n');
        Files.writeString(out.resolve("keys.csv"), csv);
        Files.writeString(out.resolve("keys.html"), KeySheet.html(signer, new Content(root), count));
        System.out.print(csv);
        System.out.println("Wrote " + out.resolve("keys.html") + " (open it and print at 100% scale).");
    }
}
