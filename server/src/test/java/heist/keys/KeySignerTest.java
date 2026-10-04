package heist.keys;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class KeySignerTest {
    @Test
    void signedCodesRoundTripAndForgeriesFail() {
        KeySigner s = new KeySigner("secret-a");
        for (int i = 1; i <= 8; i++) {
            String code = s.code(i);
            assertTrue(code.matches("HK\\d-[0-9A-F]{6}"), code);
            assertEquals(i, s.verify(code));
            assertEquals(i, s.verify(code.toLowerCase()), "manual entry is case-insensitive");
            assertEquals(i, s.verify("https://heist.example/k?k=" + code), "QR may carry a URL");
        }
        assertEquals(-1, s.verify("HK1-000000"));
        assertEquals(-1, s.verify("garbage"));
        assertEquals(-1, new KeySigner("secret-b").verify(s.code(1)), "another secret cannot claim our vaults");
        assertNotEquals(s.code(1), s.code(2));
    }
}
