package heist.keys;

import heist.api.Qr;
import heist.game.Content;

/** PH-01 print-ready A4 sheet: 8 key tags, each with a QR front and the short backup code. */
public final class KeySheet {
    private KeySheet() {}

    public static String html(KeySigner signer, Content content, int count) {
        StringBuilder tags = new StringBuilder();
        for (int i = 1; i <= count; i++) {
            String code = signer.code(i);
            tags.append("""
                    <div class="tag">
                      <div class="vault">VAULT %d</div>
                      <img src="%s" alt="QR for %s">
                      <div class="name">%s</div>
                      <div class="code">%s</div>
                      <div class="hint">Can't scan? Type the code.</div>
                    </div>
                    """.formatted(i, Qr.dataUri(code, 360), code, esc(content.vaultName(i)), code));
        }
        return """
                <!doctype html>
                <html><head><meta charset="utf-8"><title>HEIST HAVOC! key tags</title>
                <style>
                  @page { size: A4; margin: 10mm; }
                  body { font-family: system-ui, sans-serif; margin: 0; }
                  h1 { font-size: 14px; margin: 0 0 6mm; }
                  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6mm; }
                  .tag { border: 1.5px dashed #444; border-radius: 4mm; padding: 4mm; text-align: center; break-inside: avoid; }
                  .tag img { width: 38mm; height: 38mm; image-rendering: pixelated; }
                  .vault { font-weight: 900; letter-spacing: .1em; font-size: 15px; }
                  .name { font-size: 11px; margin-top: 1mm; }
                  .code { font: 700 17px ui-monospace, monospace; letter-spacing: .06em; margin-top: 2mm; }
                  .hint { font-size: 9px; color: #555; }
                </style></head>
                <body><h1>HEIST HAVOC! key tags. Cut on the dashed line, laminate if you can, clip one to each key lanyard.</h1>
                <div class="grid">%s</div></body></html>
                """.formatted(tags);
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;");
    }
}
