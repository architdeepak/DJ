# Airdeck

A two-deck browser DJ mixer with a webcam AR overlay and pinch-to-control hand tracking. Built from the original DJ repository, which contained only an empty `djpython.py`.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended) and a recent Chrome or Edge browser.

```sh
npm install
npm run dev
```

Open the Local URL printed by Vite, normally **http://127.0.0.1:5173/**. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Installation copies MediaPipe's WebAssembly files and prepares the hand-landmark model. The model is included in the repo; if missing, the setup script downloads it from Google's official model storage. Tracking runs locally, with no account, API key, or backend.

## First mix

1. Click **Load demo pair** to load two original instrumental loops. They loop automatically. Or load any track from the crate into A or B.
2. Press each deck's **Play**, or press **Space** to start both loaded decks.
3. Move the transition slider to blend between tracks. Volume, speed, pitch, and effects are independent per deck.
4. Click **Enable camera** and allow camera access. Keep your hands visible in good lighting.
5. Choose a hand-control mode, pinch your thumb and index finger together, and move. Release to hold the current value.
6. Click **Record mix**, perform, then **Stop & save** to download the master output as WebM/Opus (or M4A on browsers that support it).

## Hand controls

- **Transition:** pinch and move horizontally to blend A into B. One hand owns the crossfader until it releases or leaves the frame.
- **Volume:** pinch on the left side of the camera view for deck A, right for B. Move up/down for volume.
- **Pitch:** move up/down for −12 to +12 semitones, independently of speed.
- **Speed:** move up/down for 0.65× to 1.35× speed, independently of pitch.
- **Effects:** move up/down to blend a low-pass filter and echo.

Deck selection locks when a pinch starts, so crossing the center while pinching keeps controlling the same track. Pinch detection uses hand-relative distances, separate engage/release thresholds, and coordinate smoothing to reduce jitter. Tracking loss stops changes and leaves audio playing at its current settings.

Keyboard: **Space** plays/pauses loaded decks, **1–5** choose gesture modes, **?** opens the guide, and **Esc** stops the camera. Sliders support standard keyboard controls. The entire mixer is usable without a camera.

## Getting songs

- **Starter tracks:** two original, procedurally synthesized instrumentals included in the app. No recording downloads required.
- **Audius catalog:** search artists/tracks or browse weekly trending music. The app fetches streamable, ungated full tracks through the public Audius API. Some tracks may become unavailable; errors leave the currently loaded deck intact. Catalog requests fail over between two discovery hosts. This is the Audius catalog, not a search across every commercial music service.
- **Your files:** import or drag MP3, WAV, OGG, FLAC, AAC, or M4A onto a deck. Format support depends on browser codecs. Files remain in browser memory and are never uploaded. Limits: 90 MB per file and 20 minutes per decoded track. Imported files and the current session are cleared on refresh.

Tracks load fully into memory before playback, enabling precise seeking and independent time stretching/pitch shifting. BPM is displayed for the original demo tracks; unknown BPM is explicitly left blank. Speed changes do not provide automatic beat matching.

## Architecture

- Vanilla JavaScript and CSS, built with Vite. Responsive hardware-inspired console with two deck colors, waveforms from decoded audio, and a mirrored webcam view with hand skeletons and live control labels.
- Web Audio graph per deck: **AudioWorklet → low-pass filter → volume → equal-power crossfade → master limiter → speakers / recording**. A feedback echo runs in parallel. SoundTouchJS provides independent tempo and pitch processing inside the worklet, separate from camera inference. Loops reset in the audio thread.
- MediaPipe Hand Landmarker detects up to two hands. Tracking assets are hosted with the app, and inference is limited to roughly 20 frames/second. GPU initialization falls back to CPU when necessary. Camera frames are processed locally and never recorded by the mix recorder.
- `src/dsp.js` contains the shared audio processor. `src/audio.js` owns the audio graph. `src/gestures.js` owns tracking. `src/catalog.js` owns music discovery. `src/main.js` connects application state to controls.

## Build and checks

```sh
npm test
npm run build
npm run preview
```

Deploy the generated `dist/` folder to any static HTTPS host. Camera and AudioWorklet require HTTPS or localhost; opening `index.html` directly does not work. Keep `dist/models`, `dist/vision`, and all generated JavaScript assets together. Deployment assumes hosting at the domain root.

Tests exercise actual SoundTouch signal processing (finite audio output, duration, pitch preservation, octave shifts, seeking), the worklet message lifecycle and looping, equal-power crossfading, pinch hysteresis, deck locking, hand ownership, catalog filtering/failover, cancellation, and stream size limits. They run in Node and do not substitute for a physical webcam/browser test.

Current verification: all automated checks and the production build pass. Live Audius catalog and audio-byte retrieval have been checked, including CORS headers. A real camera session, browser audio device output, responsive visual inspection, and recorded-file download still need interactive browser verification; automated desktop browser access was denied in the development environment.

## Credits

Hand tracking: [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Music discovery: [Audius API](https://docs.audius.co/api/). Time stretching and pitch processing: [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS), LGPL-2.1; its unmodified distributable and license are included under `public/vendor/soundtouch/`. See [THIRD_PARTY.md](THIRD_PARTY.md).
