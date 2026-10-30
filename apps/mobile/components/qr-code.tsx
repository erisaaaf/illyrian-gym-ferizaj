import { useMemo } from "react";
import { View } from "react-native";
import QRCode from "qrcode";

/**
 * Draws a QR code from the module matrix with plain Views, so it works on iOS, Android and web without a native
 * SVG dependency. Always dark-on-white with a quiet zone, because scanners need that contrast whatever the app theme.
 */
export function QrCode({ value, size = 224 }: { value: string; size?: number }) {
  const { matrix, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    return { matrix: qr.modules, count: qr.modules.size };
  }, [value]);
  const cell = Math.max(1, Math.floor(size / count));
  const rows = Array.from({ length: count }, (_, y) => y);
  const cols = Array.from({ length: count }, (_, x) => x);

  return (
    <View style={{ backgroundColor: "#ffffff", padding: cell * 2, borderRadius: 12 }} accessibilityRole="image" accessibilityLabel="Your check-in QR code">
      {rows.map((y) => (
        <View key={y} style={{ flexDirection: "row" }}>
          {cols.map((x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: matrix.get(y, x) ? "#0a0d0b" : "#ffffff" }} />
          ))}
        </View>
      ))}
    </View>
  );
}
