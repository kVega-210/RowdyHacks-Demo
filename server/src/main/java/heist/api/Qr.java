package heist.api;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;

/** QR PNGs via ZXing: join links on the host screen and the printable key tags (PH-01). */
public final class Qr {
    private Qr() {}

    public static byte[] png(String text, int size) {
        try {
            BitMatrix m = new QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size,
                    Map.of(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M, EncodeHintType.MARGIN, 2));
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(m, "PNG", out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalArgumentException("Cannot encode QR", e);
        }
    }

    public static String dataUri(String text, int size) {
        return "data:image/png;base64," + Base64.getEncoder().encodeToString(png(text, size));
    }
}
