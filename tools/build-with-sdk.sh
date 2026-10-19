#!/usr/bin/env bash
# Standard Android SDK build path. The supplied APK was made with build_apk.py.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
: "${SDK:?Set ANDROID_HOME to your Android SDK directory.}"
BUILD_TOOLS="${BUILD_TOOLS_VERSION:-37.0.0}"
ANDROID_API="${ANDROID_API:-37}"
BT="$SDK/build-tools/$BUILD_TOOLS"; JAR="$SDK/platforms/android-$ANDROID_API/android.jar"
for tool in aapt2 d8 zipalign apksigner; do
  [ -x "$BT/$tool" ] || { echo "Missing: $BT/$tool" >&2; exit 1; }
done
[ -f "$JAR" ] || { echo "Missing: $JAR" >&2; exit 1; }
python3 "$ROOT/tools/bundle.py"
OUT="$ROOT/build-sdk"; rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/dex"
MAIN="$ROOT/android/app/src/main"
[ -f "$MAIN/res/drawable/ic_launcher.png" ] || { echo "Missing bundled launcher icon" >&2; exit 1; }
"$BT/aapt2" compile --dir "$MAIN/res" -o "$OUT/resources.zip"
"$BT/aapt2" link -I "$JAR" --manifest "$MAIN/AndroidManifest.xml" \
  -R "$OUT/resources.zip" -A "$MAIN/assets" -o "$OUT/base.apk"
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$JAR" -d "$OUT/classes" \
  "$MAIN/java/de/gleisgasse/prototyp/MainActivity.java"
"$BT/d8" --lib "$JAR" --min-api 30 --output "$OUT/dex" \
  "$OUT/classes/de/gleisgasse/prototyp/MainActivity.class"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q "$OUT/unsigned.apk" classes.dex)
"$BT/zipalign" -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"
# Create/reuse a LOCAL test key. It is excluded from Git and differs per checkout.
python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); from build_apk import signing_material; signing_material()' "$ROOT/tools"
openssl pkcs8 -topk8 -nocrypt -in "$ROOT/tools/TEST-ONLY-key.pem" -outform DER -out "$OUT/key.pk8"
openssl x509 -in "$ROOT/tools/TEST-ONLY-cert.pem" -outform DER -out "$OUT/cert.der"
"$BT/apksigner" sign --key "$OUT/key.pk8" --cert "$OUT/cert.der" \
  --out "$OUT/Gleis-und-Gasse-0.2.0-sdk.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/Gleis-und-Gasse-0.2.0-sdk.apk"
echo "APK: $OUT/Gleis-und-Gasse-0.2.0-sdk.apk"
