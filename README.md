# AeroPlay (Browser)

A simple local video player that runs in Chrome without installation.

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
npm start
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

