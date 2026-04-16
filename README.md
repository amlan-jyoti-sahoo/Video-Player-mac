# Local Video Player (macOS)

A simple local video player desktop app for your Mac.

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
- Native macOS file picker in desktop app mode

## Run as a desktop app

1. Open Terminal in this folder.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm start
```

4. Click Open Video for one file or Open Folder to load all videos from a directory.
5. You can also drag and drop a video or folder directly into the app window.

## Build a macOS app bundle

Run:

```bash
npm run dist:mac
```

Packaged outputs will be generated in the `dist/` folder.

## Notes

- Keyboard shortcuts work when focus is not inside a text input.
- The app runs locally on your machine.


## upcoming feature
<!-- To Be -->
-> will take smiliar color palet like youtube
-> show the prev played video percentage with red mark in left slide bar preview for both grid and list
-> secert Mode. can crop any video for only content areat

## Bug
<!-- InProgress -->

