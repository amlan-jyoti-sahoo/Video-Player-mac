const fileInput = document.getElementById("videoFile");
const openNativeButton = document.getElementById("openNative");
const openFolderButton = document.getElementById("openFolder");
const playlistElement = document.getElementById("playlist");
const video = document.getElementById("video");
const statusText = document.getElementById("status");

let ownedObjectUrl = null;
let playlist = [];
let selectedIndex = -1;
let thumbnailGenerationId = 0;

function revokePlaylistObjectUrls(items) {
  for (const item of items) {
    if (item.ownedObjectUrl && item.videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.videoUrl);
    }
  }
}

function clearObjectUrl() {
  if (ownedObjectUrl) {
    URL.revokeObjectURL(ownedObjectUrl);
    ownedObjectUrl = null;
  }
}

function setVideoSource(url, label, nextOwnedObjectUrl = null) {
  clearObjectUrl();
  ownedObjectUrl = nextOwnedObjectUrl;

  video.src = url;
  video.load();
  statusText.textContent = `Loaded: ${label}`;
}

function escapeHtml(rawValue) {
  return String(rawValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function updatePlaylistSelectionUI() {
  const cards = playlistElement.querySelectorAll(".playlist-item");

  for (const card of cards) {
    const index = Number(card.dataset.index);
    const isSelected = index === selectedIndex;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-selected", String(isSelected));
  }
}

function selectVideo(index) {
  if (index < 0 || index >= playlist.length) {
    return;
  }

  if (index === selectedIndex) {
    updatePlaylistSelectionUI();
    return;
  }

  selectedIndex = index;
  const selected = playlist[index];
  setVideoSource(
    selected.videoUrl,
    selected.fileName,
    selected.ownedObjectUrl ? selected.videoUrl : null
  );
  updatePlaylistSelectionUI();
}

function renderPlaylist() {
  playlistElement.innerHTML = "";

  if (playlist.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  playlist.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "playlist-item";
    button.dataset.index = String(index);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === selectedIndex));

    const thumbnailHtml = item.thumbnail
      ? `<img class="playlist-thumb" src="${item.thumbnail}" alt="Preview of ${escapeHtml(item.fileName)}" />`
      : `<div class="playlist-thumb placeholder">No preview</div>`;

    button.innerHTML = `
      ${thumbnailHtml}
      <span class="playlist-name" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</span>
    `;

    button.addEventListener("click", () => {
      selectVideo(index);
    });

    fragment.appendChild(button);
  });

  playlistElement.appendChild(fragment);
  updatePlaylistSelectionUI();
}

function createThumbnail(videoUrl) {
  return new Promise((resolve) => {
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.muted = true;
    tempVideo.src = videoUrl;

    const timeoutId = window.setTimeout(() => {
      resolve(null);
    }, 2500);

    function finalize(result) {
      window.clearTimeout(timeoutId);
      resolve(result);
    }

    tempVideo.addEventListener("error", () => {
      finalize(null);
    }, { once: true });

    tempVideo.addEventListener("loadeddata", () => {
      const targetTime = Number.isFinite(tempVideo.duration)
        ? Math.min(Math.max(tempVideo.duration * 0.2, 0), 8)
        : 0;

      if (targetTime <= 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 240;
          canvas.height = 135;
          const context = canvas.getContext("2d");

          if (!context) {
            finalize(null);
            return;
          }

          context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          finalize(canvas.toDataURL("image/jpeg", 0.72));
        } catch {
          finalize(null);
        }
        return;
      }

      tempVideo.currentTime = targetTime;
    }, { once: true });

    tempVideo.addEventListener("seeked", () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 240;
        canvas.height = 135;
        const context = canvas.getContext("2d");

        if (!context) {
          finalize(null);
          return;
        }

        context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        finalize(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        finalize(null);
      }
    }, { once: true });
  });
}

async function buildThumbnails() {
  const buildId = ++thumbnailGenerationId;

  for (let i = 0; i < playlist.length; i += 1) {
    if (buildId !== thumbnailGenerationId) {
      return;
    }

    const item = playlist[i];
    if (item.thumbnail) {
      continue;
    }

    // Sequential thumbnail generation avoids spikes with large folders.
    const thumbnail = await createThumbnail(item.videoUrl);

    if (buildId !== thumbnailGenerationId) {
      return;
    }

    item.thumbnail = thumbnail;
    const card = playlistElement.querySelector(`.playlist-item[data-index="${i}"]`);

    if (!card) {
      continue;
    }

    const oldThumb = card.querySelector(".playlist-thumb");
    if (!oldThumb) {
      continue;
    }

    if (!thumbnail) {
      continue;
    }

    const image = document.createElement("img");
    image.className = "playlist-thumb";
    image.src = thumbnail;
    image.alt = `Preview of ${item.fileName}`;
    oldThumb.replaceWith(image);
  }
}

function setPlaylist(items) {
  if (!Array.isArray(items) || items.length === 0) {
    statusText.textContent = "No supported videos were found.";
    return;
  }

  revokePlaylistObjectUrls(playlist);
  playlist = items.map((item) => ({ ...item, thumbnail: null }));
  selectedIndex = -1;
  renderPlaylist();
  selectVideo(0);
  statusText.textContent = `Loaded ${playlist.length} video${playlist.length === 1 ? "" : "s"}.`;
  buildThumbnails();
}

function getDroppedPaths(event) {
  const files = [...(event.dataTransfer?.files ?? [])];
  const fromFiles = files.map((file) => file.path).filter(Boolean);

  if (fromFiles.length > 0) {
    return fromFiles;
  }

  const items = [...(event.dataTransfer?.items ?? [])];
  return items
    .map((item) => item.getAsFile?.()?.path)
    .filter(Boolean);
}

fileInput.addEventListener("change", () => {
  const files = [...(fileInput.files ?? [])];

  if (files.length === 0) {
    return;
  }

  if (files.length === 1) {
    const [file] = files;
    const nextObjectUrl = URL.createObjectURL(file);
    revokePlaylistObjectUrls(playlist);
    playlist = [];
    selectedIndex = -1;
    renderPlaylist();
    setVideoSource(nextObjectUrl, file.name, nextObjectUrl);
    return;
  }

  const filePlaylist = files.map((file) => ({
    fileName: file.name,
    videoUrl: URL.createObjectURL(file),
    ownedObjectUrl: true
  }));

  setPlaylist(filePlaylist);
  if (playlist[0]?.videoUrl && playlist[0].ownedObjectUrl) {
    ownedObjectUrl = playlist[0].videoUrl;
  }
});

openNativeButton.addEventListener("click", async () => {
  if (!window.electronAPI?.openVideoDialog) {
    statusText.textContent = "Native file picker is only available in desktop app mode.";
    return;
  }

  const result = await window.electronAPI.openVideoDialog();

  if (!result) {
    return;
  }

  setPlaylist([result]);
});

openFolderButton.addEventListener("click", async () => {
  if (!window.electronAPI?.openVideoFolderDialog) {
    statusText.textContent = "Native folder picker is only available in desktop app mode.";
    return;
  }

  const items = await window.electronAPI.openVideoFolderDialog();

  if (!items || items.length === 0) {
    statusText.textContent = "No videos found in that folder.";
    return;
  }

  setPlaylist(items);
});

window.addEventListener("dragover", (event) => {
  event.preventDefault();
  document.body.classList.add("drag-active");
});

window.addEventListener("dragleave", (event) => {
  if (event.relatedTarget === null) {
    document.body.classList.remove("drag-active");
  }
});

window.addEventListener("drop", async (event) => {
  event.preventDefault();
  document.body.classList.remove("drag-active");

  const droppedPaths = getDroppedPaths(event);
  if (droppedPaths.length === 0) {
    statusText.textContent = "Drop a video file or folder from Finder.";
    return;
  }

  if (!window.electronAPI?.resolveDroppedPaths) {
    statusText.textContent = "Drag and drop folder support is available in desktop app mode.";
    return;
  }

  const items = await window.electronAPI.resolveDroppedPaths(droppedPaths);
  setPlaylist(items);
});

window.addEventListener("keydown", (event) => {
  // Ignore shortcuts while typing in input fields.
  const activeTag = document.activeElement?.tagName;
  if (
    activeTag === "INPUT" ||
    activeTag === "TEXTAREA" ||
    document.activeElement?.isContentEditable
  ) {
    return;
  }

  if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
    event.preventDefault();

    if (video.paused) {
      video
        .play()
        .then(() => {
          statusText.textContent = "Playing";
        })
        .catch(() => {
          statusText.textContent = "Unable to play video.";
        });
    } else {
      video.pause();
      statusText.textContent = "Paused";
    }

    return;
  }

  if (event.code === "ArrowLeft") {
    event.preventDefault();
    video.currentTime = Math.max(0, video.currentTime - 10);
    statusText.textContent = `Seeked to ${video.currentTime.toFixed(1)}s`;
    return;
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    const duration = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime + 10;
    video.currentTime = Math.min(duration, video.currentTime + 10);
    statusText.textContent = `Seeked to ${video.currentTime.toFixed(1)}s`;
  }
}, true);

video.addEventListener("ended", () => {
  statusText.textContent = "Playback ended.";
});

window.addEventListener("beforeunload", () => {
  revokePlaylistObjectUrls(playlist);

  clearObjectUrl();
});
