# Device reference notes

These references were checked during the initial audit. Use the exact model and revision visible on the physical instrument where possible; related models in the same product family are not interchangeable.

## UNI-T UTD2102CEX+ oscilloscope

- UNI-T product reference: https://uni-trend.com.vn/products/utd2102cex-100mhz-2ch-dso-7in-screen-64kpts-memory.html
- Verified headline specifications: 100MHz bandwidth, 2 analog channels, 1GSa/s maximum real-time sample rate, 64kpts memory depth, 7-inch display, and 5,000 waveform captures/s.
- The simulator should not imply that its current 250-point browser waveform refresh is equivalent to the scope's hardware sample rate or acquisition system.

## Longwei LW-1641 function generator

- Manufacturer manual (PDF): https://longweielec.com/download/120/function-signal-generator-support/1549/longwei-function-signal-generator-user-manual-en-version-doc.pdf
- Manufacturer product page: https://longweielec.com/product/lw-1641
- Verified from the manual: 0.1Hz–2MHz; sine, triangle, square, ramp and pulse variants; 50Ω ±10% output impedance; at least 20Vp-p open-circuit amplitude; ±10V DC bias; 90:10 to 10:90 symmetry; TTL/CMOS synchronous output; 20dB and 40dB attenuation.
- The manufacturer product page contains a conflicting amplitude figure (50Vp-p) while its downloadable manual states at least 20Vp-p. The manual is used as the primary reference for now; do not silently change the simulator's amplitude ceiling until the user's exact unit/manual is confirmed.

## ATTEN APS3005S power supply

- APS-series manual (PDF): https://www.labima.unifi.it/upload/sub/Strumentazione/Manuali/APS%20series.pdf
- Verified for the single-channel APS3005S: 0–30V, 0–5A, 150W, CV/CC operation, LED voltage/current display, overload/short-circuit/over-temperature protection. The APS3005S-3D is a different multi-output model and must not be confused with the single-channel APS3005S.

## UNI-T UT33D+ multimeter

- UNI-T UT33+ series manual (PDF): https://uni-t.hu/userfiles/webshop/products/attachments/UT33A--UT33B--UT33C--UT33D--English-Manual%284%29.pdf
- Verified for UT33D+: NCV feature; 1999-count display; manual range selection; approx. 10MΩ voltage input; DC voltage ranges 200mV to 600V; AC voltage ranges 200V and 600V; resistance ranges through 200MΩ; diode and continuity; DC current ranges 2000µA, 20mA, 200mA and 10A. AC current is listed for UT33A+ only, not UT33D+.
- AC voltage is average-responding, sine-RMS calibrated, with specified sine-wave frequency response of 40–400Hz. This is why the AC waveform model was corrected from true-RMS for non-sine signals.
