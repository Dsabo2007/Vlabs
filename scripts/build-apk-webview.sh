#!/usr/bin/env bash
# Builds a signed, installable offline APK without Gradle or a full Android SDK.
# Uses the installed Java 8 runtime plus official build-tools (aapt2, d8, apksigner).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
TOOLS="$ROOT/.android-build/tools2"
BUILD="$ROOT/.android-build/build2"
SEVENZ="/c/Program Files/7-Zip/7z.exe"
JRE="/c/Program Files/Java/jre1.8.0_251/bin"
JAVA="$JRE/java.exe"
KEYTOOL="$JRE/keytool.exe"
PLATFORM_BYTES=52328361
BUILD_TOOLS_BYTES=55201638
ECJ_BYTES=2989263
LOG() { echo "[$(date +%H:%M:%S)] $*"; }

mkdir -p "$TOOLS" "$BUILD"
cd "$TOOLS"

get() {
  local url="$1" out="$2" want="$3" have
  if [ -f "$out" ]; then
    have=$(stat -c%s "$out" 2>/dev/null || echo 0)
    [ "$have" -eq "$want" ] && return 0
    [ "$have" -gt "$want" ] && rm -f "$out"
  fi
  local i
  for i in 1 2 3 4 5 6; do
    curl -L --http1.1 -C - --connect-timeout 20 --speed-time 45 --speed-limit 1024 \
      --max-time 900 --retry 6 --retry-all-errors --retry-delay 2 -o "$out" "$url" || true
    [ "$(stat -c%s "$out" 2>/dev/null || echo 0)" -eq "$want" ] && return 0
    sleep 2
  done
  return 1
}

LOG "Downloading/resuming toolchain from Tencent mirror"
get "https://mirrors.cloud.tencent.com/AndroidSDK/platform-30_r03.zip" platform-t.zip "$PLATFORM_BYTES" & GP=$!
get "https://mirrors.cloud.tencent.com/AndroidSDK/build-tools_r29.0.3-windows.zip" build-tools-t.zip "$BUILD_TOOLS_BYTES" & GB=$!
get "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/3.21.0/ecj-3.21.0.jar" ecj.jar "$ECJ_BYTES" & GE=$!
wait $GP $GB $GE || true

LOG "platform=$(stat -c%s platform-t.zip 2>/dev/null || echo 0) build-tools=$(stat -c%s build-tools-t.zip 2>/dev/null || echo 0) ecj=$(stat -c%s ecj.jar 2>/dev/null || echo 0)"
[ "$(stat -c%s platform-t.zip)" -eq "$PLATFORM_BYTES" ] || { LOG "platform size mismatch"; exit 11; }
[ "$(stat -c%s build-tools-t.zip)" -eq "$BUILD_TOOLS_BYTES" ] || { LOG "build-tools size mismatch"; exit 12; }
[ "$(stat -c%s ecj.jar)" -eq "$ECJ_BYTES" ] || { LOG "ecj size mismatch"; exit 13; }

LOG "Extracting"
mkdir -p platform build-tools
"$SEVENZ" x -y -oplatform platform-t.zip >/dev/null
"$SEVENZ" x -y -obuild-tools build-tools-t.zip >/dev/null

ANDROID_JAR=$(find "$TOOLS/platform" -name android.jar | head -1)
AAPT2=$(find "$TOOLS/build-tools" -name aapt2.exe | head -1)
BT=$(dirname "$AAPT2")
[ -n "$ANDROID_JAR" ] && [ -n "$AAPT2" ] || { LOG "Android tools missing"; exit 14; }
LOG "android.jar=$ANDROID_JAR"
LOG "build-tools=$BT"

rm -rf "$BUILD"
mkdir -p "$BUILD/classes" "$BUILD/dex" "$BUILD/res" "$BUILD/assets"

LOG "Staging web assets"
cp -r "$ROOT/dist" "$BUILD/assets/public"

LOG "Compiling launcher icons"
for d in "$ROOT"/android/app/src/main/res/mipmap-*; do
  name=$(basename "$d")
  mkdir -p "$BUILD/res/$name"
  cp "$d"/ic_launcher*.png "$BUILD/res/$name/" 2>/dev/null || true
done

LOG "Compiling resources"
"$AAPT2" compile --dir "$BUILD/res" -o "$BUILD/res.zip"

LOG "Compiling Java"
"$JAVA" -jar ecj.jar -source 1.8 -target 1.8 -nowarn \
  -bootclasspath "$ANDROID_JAR" -d "$BUILD/classes" \
  "$ROOT/android-manual/src/com/virtuallab/electronics/MainActivity.java"

LOG "Dexing"
"$JAVA" -cp "$BT/lib/d8.jar" com.android.tools.r8.D8 \
  --min-api 26 --lib "$ANDROID_JAR" \
  --output "$BUILD/dex" "$BUILD/classes/com/virtuallab/electronics/MainActivity.class"

LOG "Linking APK"
"$AAPT2" link -o "$BUILD/base.apk" -I "$ANDROID_JAR" \
  --manifest "$ROOT/android-manual/AndroidManifest.xml" \
  -R "$BUILD/res.zip" -A "$BUILD/assets" \
  --min-sdk-version 26 --target-sdk-version 29 \
  --version-code 1 --version-name 1.0

LOG "Adding classes.dex"
python - "$BUILD" <<'PY'
import os, shutil, sys, zipfile
build = sys.argv[1]
shutil.copyfile(os.path.join(build, 'base.apk'), os.path.join(build, 'unsigned.apk'))
with zipfile.ZipFile(os.path.join(build, 'unsigned.apk'), 'a', zipfile.ZIP_DEFLATED) as apk:
    apk.write(os.path.join(build, 'dex', 'classes.dex'), 'classes.dex')
PY

LOG "Aligning"
"$BT/zipalign.exe" -f 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [ ! -f "$BUILD/debug.keystore" ]; then
  LOG "Creating debug keystore"
  "$KEYTOOL" -genkeypair -keystore "$BUILD/debug.keystore" -storepass android \
    -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi

LOG "Signing"
mkdir -p "$ROOT/release"
"$JAVA" -jar "$BT/lib/apksigner.jar" sign \
  --ks "$BUILD/debug.keystore" --ks-pass pass:android --key-pass pass:android \
  --min-sdk-version 26 \
  --out "$ROOT/release/Virtual-Electronics-Lab-1.0.0-android.apk" "$BUILD/aligned.apk"

LOG "Verifying"
"$JAVA" -jar "$BT/lib/apksigner.jar" verify --print-certs \
  "$ROOT/release/Virtual-Electronics-Lab-1.0.0-android.apk" | head -4

LOG "APK_READY $(stat -c%s "$ROOT/release/Virtual-Electronics-Lab-1.0.0-android.apk") bytes"
