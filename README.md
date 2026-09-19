# AeroPlay

A simple local video player for macOS and modern browsers.

## Build the macOS app

The DMG must be signed with a `Developer ID Application` certificate and notarized before it is shared. An unsigned, development-signed, or ad-hoc-signed DMG can be reported by macOS as malware even when the source is safe.

Install dependencies and build the Apple Silicon DMG on a Mac enrolled in the Apple Developer Program:

```bash
npm install
npm run dist:mac
```

For local testing without an Apple Developer certificate, build an unsigned DMG:

```bash
npm run dist:mac:local
```

The local DMG is created at `dist/AeroPlay-1.0.1-arm64.dmg`. It is not suitable for distribution and macOS may block it because it is unsigned. After copying `AeroPlay.app` to Applications, open it with Finder using Control-click > Open. If macOS still blocks this locally built app, run:

```bash
xattr -dr com.apple.quarantine "/Applications/AeroPlay.app"
open "/Applications/AeroPlay.app"
```

`electron-builder` reads the standard macOS signing and notarization environment variables. Install a `Developer ID Application` certificate in Keychain, then configure your release environment, such as `CSC_LINK` and `CSC_KEY_PASSWORD` for the certificate, plus `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` for notarization. Do not commit certificates, passwords, or API keys.

The build is intentionally configured with `forceCodeSigning`, so it fails instead of producing another DMG that Gatekeeper will reject.

For a local Electron development run, use `npm start`.

## Features

- Open any local video file (`.mp4`, `.mov`, etc.)
- Open a folder and auto-load all videos
- Horizontal scrollable video strip with small previews
- Click any preview card to switch the main player video
- Drag and drop video files or folders from Finder
- If a folder is dropped, all videos appear in the horizontal strip
- First video is selected by default and shown in the large player
- `Space` to play/pause
- `Left Arrow` to rewind 10 seconds
- `Right Arrow` to forward 10 seconds
- Chrome file and folder picker

## Run in Chrome

1. Open Terminal in this folder and start the local web server:

```bash
npm run start:web
```

2. Open [http://127.0.0.1:4173](http://127.0.0.1:4173) in Chrome.
3. Click Open Video for one or more files, or Open Folder to load videos from a directory.

You may also open `index.html` directly in Chrome. Drag-and-drop accepts video files; use Open Folder for folder selection.

## Notes

- Keyboard shortcuts work when focus is not inside a text input.
- The app runs locally on your machine. Browser playback progress is saved in Chrome local storage for each selected file or folder playlist; browsers cannot save it inside the selected folder.


## upcoming feature
<!-- To Be -->
-> will take smiliar color palet like youtube
-> show the prev played video percentage with red mark in left slide bar preview for both grid and list

## Bug
<!-- InProgress -->

