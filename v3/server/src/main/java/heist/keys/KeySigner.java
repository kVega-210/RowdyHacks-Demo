package heist.keys;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * PH-01 signed key IDs. A key code looks like {@code HK3-1F9A2C}: vault number plus the first 6 hex chars
 * of HMAC-SHA256(secret, "HK3"). The code doubles as the short backup code typed by hand, and is what the
 * QR tag encodes. Without the secret nobody can mint a code that claims a vault.
 */
public final class KeySigner {
    private static final Pattern CODE = Pattern.compile("^HK(\\d{1,2})-([0-9A-F]{6})$");
    public static final String DEV_SECRET = "heist-havoc-dev-secret";

    private final byte[] secret;

    public KeySigner(String secret) {
        this.secret = (secret == null || secret.isBlank() ? DEV_SECRET : secret).getBytes(StandardCharsets.UTF_8);
    }

    public static KeySigner fromEnv() {
        return new KeySigner(System.getenv("HEIST_KEY_SECRET"));
    }

    public String code(int vaultNo) {
        String id = "HK" + vaultNo;
        return id + "-" + sig(id);
    }

    /** Returns the vault number for a valid code, or -1. Accepts lower case and stray whitespace. */
    public int verify(String code) {
        if (code == null) return -1;
        String c = code.trim().toUpperCase(Locale.ROOT).replace(' ', '-');
        int q = c.lastIndexOf("K=");
        if (q >= 0) c = c.substring(q + 2);
        Matcher m = CODE.matcher(c);
        if (!m.matches()) return -1;
        String id = "HK" + m.group(1);
        if (!java.security.MessageDigest.isEqual(sig(id).getBytes(StandardCharsets.UTF_8), m.group(2).getBytes(StandardCharsets.UTF_8))) {
            return -1;
        }
        return Integer.parseInt(m.group(1));
    }

    private String sig(String id) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            byte[] h = mac.doFinal(id.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().withUpperCase().formatHex(h).substring(0, 6);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
