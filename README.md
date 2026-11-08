# Virtual Electronics Lab

A React + TypeScript + Vite virtual electronics laboratory containing a UNI-T UTD2102CEX+ oscilloscope interface, LW-1641 function generator, ATTEN APS3005S power supply, UNI-T UT33D+ multimeter, and trainer board.

## Run locally on Windows

1. Install Node.js 20.19+ or 22.12+ (npm is included): https://nodejs.org/
2. Double-click `run.bat` in this project folder.
3. On the first run, the script installs dependencies automatically, then starts the app and opens it in your browser.

Keep the command window open while using the lab. Press `Ctrl+C` in that window to stop the development server.

## Run manually

**Prerequisite:** Node.js compatible with the installed Vite version.

```bash
npm install --no-audit --no-fund
npm run dev
```

If the project uses Gemini-backed features, configure `GEMINI_API_KEY` in `.env.local` using `.env.example` as the template. Never commit a real API key.

## Checks

```bash
npm run lint
npm test
npm run build
```

## Engineering notes

- `docs/AUDIT_REPORT.md` records the initial code audit, fixes, verification status, and remaining simulation limitations.
- `docs/DEVICE_REFERENCES.md` lists the manuals and manufacturer references checked for the instrument models.
- The circuit engine currently combines formula-based examples and named-port heuristics. It is not yet a general-purpose SPICE/MNA simulator; see the audit report before relying on it for physical design decisions.

## Board visual update (V5)

- Removed the analog galvanometer from the trainer-board face.
- Reworked the resistor bank as blue printed PCB zig-zag symbols between red connection sockets, arranged in two columns.
- Reworked capacitor bank graphics to printed schematic capacitor symbols.
- Widened the board face and changed the panel/edge styling toward the supplied cream-panel, aluminum-frame reference photos.
- Added `docs/BOARD_REFERENCE_RESEARCH.md` with comparable trainer-board references and the limits of identification from the supplied photographs.

The existing resistor values and port IDs were preserved because the resistor labels in the photos are not sharp enough to transcribe reliably.


## V6 — Passive and Active Filter Board
- Added a separate filter-training board matching the supplied reference: active second-order LPF and HPF sections, plus passive LPF, HPF and BPF sections.
- Added independent clickable banana sockets for the filter inputs, outputs, jumper terminals and passive-filter terminals.
- Registered the new board in the equipment drawer and bench instrument system; existing training board and its ports remain available.
- The supplied photograph does not show component values, so the board uses the printed circuit labels (R1–R7, C1–C4, L1–L3) without inventing electrical values.

## V7 — Filter board drop fix + redesign
- **Bug fix:** dragging a board from the catalog onto the bench did nothing, because the drop handler in `App.tsx` only accepted `scope/gen/psu/dmm`. It now accepts every instrument in `INSTRUMENT_METADATA` (so `filterboard` and `board` drop correctly, and the ghost preview shows for them too).
- Filter board redrawn to match the real trainer photo (black panel, schematics, socket positions).
- Scope now shows the filter response when a filter output is probed and its input is fed by the generator (active LPF/HPF depend on J1–J4 jumpers; passive LPF/HPF/BPF use nominal L/C values).

## Desktop (Electron) and Android (Capacitor) builds

- Desktop: `npm run dist` produces `release/Virtual-Electronics-Lab-1.0.0-portable.exe` (offline, no server, single instance, zoom locked, F11 fullscreen). The packaged app was smoke-tested from `app.asar` via CDP (bench renders, `oklch()` supported).
- Android: `npm run android:apk` builds a signed, installable `release/Virtual-Electronics-Lab-1.0.0-android.apk` without Gradle. It uses the installed JRE 8 plus official `aapt2`, `d8` and `apksigner` (downloaded once into `.android-build/tools2`), and `scripts/build-apk-webview.sh` is the reproducible entry point. The APK is debug-signed, package `com.virtuallab.electronics`, minSdk 26 / targetSdk 29, about 9.2 MB. Its contents and signature were verified after the build; it has not yet been run on a physical Android device in this environment.
- The APK serves `dist/` from app assets over a virtual `https://appassets.local` origin inside a native WebView, so ES modules and `localStorage` behave exactly as on the web; it keeps one activity across rotation, enables hardware acceleration and a large heap, handles a killed renderer by rebuilding it, and pauses WebView timers in the background.
- A Capacitor 8 project is also checked in (`android/`, minSdk 24 / targetSdk 36, app id `com.virtuallab.electronics`) for building with Android Studio: `npm run android:sync` then `npm run android:apk:capacitor`.
- The packaging round uses Electron 33 (Chromium 130) so Tailwind 4 `oklch()` colours render correctly.

## V8 — BNC adapter redesign + scope logic audit

- Redesigned the BNC→dual-banana adapter (HT311) with a chrome bayonet nose, ribbed moulded body and realistic shrouded 4 mm sockets; redesigned the shared BNC jack rendering.
- Fixed scope logic found during the audit: horizontal position was applied twice, trigger coupling and EXT/AC-Line sources were not honoured, and generator DC offset ignored the OUTPUT key.
- The two photo-matched generators added while researching this revision were removed again; the LW-1641 remains the lab's signal generator.

