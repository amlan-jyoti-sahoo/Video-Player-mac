const openNativeButton = document.getElementById("openNative");
const openFolderButton = document.getElementById("openFolder");
const playlistSidebar = document.getElementById("playlistSidebar");
const sidebarToggleButton = document.getElementById("sidebarToggle");
const sidebarResizer = document.getElementById("sidebarResizer");
const layoutShell = document.querySelector(".layout-shell");
const sourceLabel = document.getElementById("sourceLabel");
const sourceDurationLabel = document.getElementById("sourceDuration");
const playlistWrap = document.querySelector(".playlist-wrap");
const playlistElement = document.getElementById("playlist");
const viewListButton = document.getElementById("viewList");
const viewGridButton = document.getElementById("viewGrid");
const playerShell = document.getElementById("playerShell");
const video = document.getElementById("video");
const overlayControls = document.getElementById("overlayControls");
const timeline = document.getElementById("timeline");
const timelineProgress = document.getElementById("timelineProgress");
const timelinePreview = document.getElementById("timelinePreview");
const timelinePreviewImage = document.getElementById("timelinePreviewImage");
const timelinePreviewTime = document.getElementById("timelinePreviewTime");
const timeModeButton = document.getElementById("timeModeButton");
const playPauseButton = document.getElementById("playPauseButton");
const playPauseIcon = document.getElementById("playPauseIcon");
const pipButton = document.getElementById("pipButton");
const controlsLockButton = document.getElementById("controlsLockButton");
const controlsLockIcon = document.getElementById("controlsLockIcon");
const speedButton = document.getElementById("speedButton");
const speedPopover = document.getElementById("speedPopover");
const speedMenu = document.getElementById("speedMenu");
const customSpeedButton = document.getElementById("customSpeedButton");
const customSpeedInputWrap = document.getElementById("customSpeedInputWrap");
const customSpeedInput = document.getElementById("customSpeedInput");
const applyCustomSpeedButton = document.getElementById("applyCustomSpeed");
const fullscreenToggleButton = document.getElementById("fullscreenToggleButton");
const fullscreenIcon = document.getElementById("fullscreenIcon");
const fullscreenNavZone = document.getElementById("fullscreenNavZone");
const prevVideoButton = document.getElementById("prevVideoButton");
const nextVideoButton = document.getElementById("nextVideoButton");
const currentFileNameLabel = document.getElementById("currentFileName");
const infoButton = document.getElementById("infoButton");
const infoDialog = document.getElementById("infoDialog");
const infoContent = document.getElementById("infoContent");
const dynamicBackdrop = document.getElementById("dynamicBackdrop");
const statusText = document.getElementById("status");
const videoStage = document.querySelector(".video-stage");

let standaloneObjectUrl = null;
let playlist = [];
let selectedIndex = -1;
let previewGenerationId = 0;
let currentSourceName = "";
let playlistView = "grid";
let timeDisplayMode = "watched";
const SPEED_STEPS = [0.5, 0.75, 1, 1.5, 2];
let hoverPreviewVideo = null;
let hoverPreviewRequestId = 0;
let lastHoverCaptureTime = 0;
let controlsLocked = false;
let controlsHideTimer = 0;
const PLAYLIST_PREVIEW_WIDTH = 640;
const PLAYLIST_PREVIEW_HEIGHT = 360;
const TIMELINE_PREVIEW_CAPTURE_WIDTH = 640;
const TIMELINE_PREVIEW_CAPTURE_HEIGHT = 360;

function escapeHtml(rawValue) {
  return String(rawValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "--:--";
  }

  const whole = Math.floor(seconds);
  const hrs = Math.floor(whole / 3600);
  const mins = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function revokePlaylistObjectUrls(items) {
  for (const item of items) {
    if (item.ownedObjectUrl && item.videoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(item.videoUrl);
    }
  }
}

function clearStandaloneObjectUrl() {
  if (standaloneObjectUrl) {
    URL.revokeObjectURL(standaloneObjectUrl);
    standaloneObjectUrl = null;
  }
}

function clearControlsHideTimer() {
  if (!controlsHideTimer) {
    return;
  }

  window.clearTimeout(controlsHideTimer);
  controlsHideTimer = 0;
}

function updateControlsLockButton() {
  controlsLockButton?.setAttribute("aria-pressed", String(controlsLocked));
  controlsLockButton?.setAttribute(
    "aria-label",
    controlsLocked ? "Allow controls to auto hide" : "Keep controls visible"
  );
  controlsLockButton?.classList.toggle("active", controlsLocked);

  if (controlsLockIcon) {
    controlsLockIcon.innerHTML = "<path d=\"M4 7h16\" /><path d=\"M7 12h10\" /><path d=\"M10 17h4\" /><circle cx=\"16\" cy=\"7\" r=\"2\" /><circle cx=\"8\" cy=\"12\" r=\"2\" /><circle cx=\"14\" cy=\"17\" r=\"2\" />";
  }
}

function shouldAutoHideControls() {
  return Boolean(video.src) && !controlsLocked && speedPopover.hidden;
}

function setControlsVisible(visible) {
  videoStage?.classList.toggle("controls-hidden", !visible);
}

function scheduleControlsHide() {
  clearControlsHideTimer();

  if (!shouldAutoHideControls()) {
    setControlsVisible(true);
    return;
  }

  controlsHideTimer = window.setTimeout(() => {
    if (!shouldAutoHideControls()) {
      return;
    }

    setControlsVisible(false);
    timelinePreview.hidden = true;
  }, 2000);
}

function showControls() {
  setControlsVisible(true);
  scheduleControlsHide();
}

function setVideoSource(url, label) {
  video.src = url;
  video.load();
  video.defaultPlaybackRate = 1;
  video.playbackRate = 1;
  updateSpeedButton();
  hideSpeedUi();
  customSpeedInput.value = "1";
  currentFileNameLabel.textContent = label;
  statusText.textContent = `Loaded: ${label}`;
  showControls();
}

function getKnownDurations() {
  return playlist
    .map((item) => item.duration)
    .filter((duration) => Number.isFinite(duration) && duration > 0);
}

function updateSourceLabels() {
  sourceLabel.textContent = currentSourceName ? `Folder: ${currentSourceName}` : "";

  if (playlist.length <= 1) {
    sourceDurationLabel.textContent = "";
    return;
  }

  const knownDurations = getKnownDurations();
  if (knownDurations.length === 0) {
    sourceDurationLabel.textContent = "Total duration: calculating...";
    return;
  }

  const total = knownDurations.reduce((sum, duration) => sum + duration, 0);
  const suffix = knownDurations.length === playlist.length ? "" : " (partial)";
  sourceDurationLabel.textContent = `Total duration: ${formatDuration(total)}${suffix}`;
}

function applyBackdrop(imageUrl) {
  if (!imageUrl) {
    dynamicBackdrop.style.backgroundImage = "";
    dynamicBackdrop.classList.remove("active");
    return;
  }

  dynamicBackdrop.style.backgroundImage = `url("${imageUrl}")`;
  dynamicBackdrop.classList.add("active");
}

function refreshViewToggleButtons() {
  viewListButton.classList.toggle("selected", playlistView === "list");
  viewGridButton.classList.toggle("selected", playlistView === "grid");
}

function updateSidebarVisibility() {
  playlistSidebar?.classList.toggle("hidden", playlist.length === 0);
}

function updateFullscreenNavigation() {
  const hasPlaylist = playlist.length > 1;
  const isFullscreen = document.fullscreenElement === playerShell;
  playerShell?.classList.toggle("is-fullscreen", isFullscreen);
  videoStage?.classList.toggle("has-playlist-nav", hasPlaylist);
  videoStage?.classList.toggle("fullscreen-nav-prev-visible", false);
  videoStage?.classList.toggle("fullscreen-nav-next-visible", false);
  fullscreenNavZone?.setAttribute("aria-hidden", String(!(isFullscreen && hasPlaylist)));

  const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : -1;
  const nextIndex = selectedIndex >= 0 && selectedIndex < playlist.length - 1
    ? selectedIndex + 1
    : -1;

  if (prevVideoButton) {
    prevVideoButton.disabled = prevIndex < 0;
  }

  if (nextVideoButton) {
    nextVideoButton.disabled = nextIndex < 0;
  }
}

function drawVideoFrameContain(context, videoElement, width, height) {
  const sourceWidth = videoElement.videoWidth || width;
  const sourceHeight = videoElement.videoHeight || height;
  const fitRatio = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = Math.max(1, Math.round(sourceWidth * fitRatio));
  const drawHeight = Math.max(1, Math.round(sourceHeight * fitRatio));
  const offsetX = Math.round((width - drawWidth) / 2);
  const offsetY = Math.round((height - drawHeight) / 2);

  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.drawImage(videoElement, offsetX, offsetY, drawWidth, drawHeight);
}

function updatePlaylistSelectionUI() {
  const cards = playlistElement.querySelectorAll(".playlist-item");
  let selectedCard = null;

  for (const card of cards) {
    const index = Number(card.dataset.index);
    const isSelected = index === selectedIndex;
    card.classList.toggle("selected", isSelected);
    card.setAttribute("aria-selected", String(isSelected));
    if (isSelected) {
      selectedCard = card;
    }
  }

  if (selectedCard && playlistView === "list") {
    selectedCard.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center"
    });
  }
}

function ensureHoverPreviewVideo(url) {
  if (hoverPreviewVideo) {
    hoverPreviewVideo.src = "";
  }

  hoverPreviewVideo = document.createElement("video");
  hoverPreviewVideo.preload = "metadata";
  hoverPreviewVideo.muted = true;
  hoverPreviewVideo.src = url;
  hoverPreviewVideo.load();
}

function selectVideo(index, { autoplay = false } = {}) {
  if (index < 0 || index >= playlist.length) {
    return;
  }

  selectedIndex = index;
  clearStandaloneObjectUrl();

  const selected = playlist[index];
  setVideoSource(selected.videoUrl, selected.fileName);
  updatePlaylistSelectionUI();
  updateFullscreenNavigation();
  ensureHoverPreviewVideo(selected.videoUrl);

  if (selected.thumbnail) {
    applyBackdrop(selected.thumbnail);
    timelinePreviewImage.src = selected.thumbnail;
  }

  if (autoplay) {
    video.play().catch(() => {
      statusText.textContent = "Unable to play video.";
    });
  }
}

function renderPlaylist() {
  playlistElement.innerHTML = "";
  playlistElement.classList.toggle("list", playlistView === "list");
  playlistElement.classList.toggle("grid", playlistView === "grid");
  playlistWrap.classList.toggle("single", playlist.length <= 1);
  refreshViewToggleButtons();
  updateSidebarVisibility();

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
    button.title = item.fileName;

    if (playlistView === "list") {
      const durationText = Number.isFinite(item.duration)
        ? formatDuration(item.duration)
        : "--:--";
      button.innerHTML = `
        <span class="playlist-name">${escapeHtml(item.fileName)}</span>
        <span class="playlist-duration">${durationText}</span>
      `;
    } else {
      const durationBadge = Number.isFinite(item.duration)
        ? `<span class="playlist-duration">${formatDuration(item.duration)}</span>`
        : "";

      const thumbnailHtml = item.thumbnail
        ? `<img class="playlist-thumb" src="${item.thumbnail}" alt="Preview of ${escapeHtml(item.fileName)}" />`
        : `<div class="playlist-thumb placeholder">No preview</div>`;

      button.innerHTML = `
        ${durationBadge}
        ${thumbnailHtml}
        <span class="playlist-name">${escapeHtml(item.fileName)}</span>
      `;
    }

    button.addEventListener("click", () => {
      selectVideo(index);
    });

    fragment.appendChild(button);
  });

  playlistElement.appendChild(fragment);
  updatePlaylistSelectionUI();
}

function updatePlaylistCard(index) {
  const card = playlistElement.querySelector(`.playlist-item[data-index="${index}"]`);
  const item = playlist[index];

  if (!card || !item) {
    return;
  }

  if (item.thumbnail) {
    const oldThumb = card.querySelector(".playlist-thumb");
    if (oldThumb && !oldThumb.matches("img")) {
      const image = document.createElement("img");
      image.className = "playlist-thumb";
      image.src = item.thumbnail;
      image.alt = `Preview of ${item.fileName}`;
      oldThumb.replaceWith(image);
    }
  }

  const existingDuration = card.querySelector(".playlist-duration");
  if (Number.isFinite(item.duration)) {
    if (existingDuration) {
      existingDuration.textContent = formatDuration(item.duration);
    } else {
      const badge = document.createElement("span");
      badge.className = "playlist-duration";
      badge.textContent = formatDuration(item.duration);
      card.prepend(badge);
    }
  }
}

function capturePreviewImage(videoElement, width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  drawVideoFrameContain(context, videoElement, width, height);
  return canvas.toDataURL("image/jpeg", 0.92);
}

function createPreviewData(videoUrl) {
  return new Promise((resolve) => {
    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";
    tempVideo.muted = true;
    tempVideo.src = videoUrl;

    let resolved = false;

    const finish = (thumbnail = null) => {
      if (resolved) {
        return;
      }
      resolved = true;
      window.clearTimeout(timeoutId);
      const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : null;
      resolve({ thumbnail, duration });
    };

    const timeoutId = window.setTimeout(() => {
      finish(null);
    }, 5000);

    tempVideo.addEventListener("error", () => {
      finish(null);
    }, { once: true });

    tempVideo.addEventListener("loadeddata", () => {
      const duration = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 0;
      const preferredSeek = clamp(duration * 0.24, 0, Math.max(0, Math.min(duration - 0.2, 10)));

      if (preferredSeek <= 0.1) {
        finish(capturePreviewImage(tempVideo, PLAYLIST_PREVIEW_WIDTH, PLAYLIST_PREVIEW_HEIGHT));
        return;
      }

      try {
        tempVideo.currentTime = preferredSeek;
      } catch {
        finish(capturePreviewImage(tempVideo, PLAYLIST_PREVIEW_WIDTH, PLAYLIST_PREVIEW_HEIGHT));
      }
    }, { once: true });

    tempVideo.addEventListener("seeked", () => {
      finish(capturePreviewImage(tempVideo, PLAYLIST_PREVIEW_WIDTH, PLAYLIST_PREVIEW_HEIGHT));
    }, { once: true });
  });
}

async function buildPlaylistPreviewData() {
  const buildId = ++previewGenerationId;

  for (let index = 0; index < playlist.length; index += 1) {
    if (buildId !== previewGenerationId) {
      return;
    }

    const item = playlist[index];
    if (item.thumbnail && Number.isFinite(item.duration)) {
      continue;
    }

    // Sequential processing avoids large memory spikes with big folders.
    const previewData = await createPreviewData(item.videoUrl);

    if (buildId !== previewGenerationId) {
      return;
    }

    if (previewData.thumbnail) {
      item.thumbnail = previewData.thumbnail;
    }
    if (Number.isFinite(previewData.duration) && previewData.duration > 0) {
      item.duration = previewData.duration;
    }

    updatePlaylistCard(index);
    updateSourceLabels();

    if (index === selectedIndex && item.thumbnail) {
      applyBackdrop(item.thumbnail);
      timelinePreviewImage.src = item.thumbnail;
    }
  }
}

function setPlaylist(items, sourceName = "") {
  clearStandaloneObjectUrl();

  if (!Array.isArray(items) || items.length === 0) {
    revokePlaylistObjectUrls(playlist);
    playlist = [];
    selectedIndex = -1;
    currentSourceName = sourceName;
    renderPlaylist();
    updateSourceLabels();
    updateFullscreenNavigation();
    statusText.textContent = "No supported videos were found.";
    applyBackdrop(null);
    currentFileNameLabel.textContent = "No file selected";
    return;
  }

  revokePlaylistObjectUrls(playlist);
  playlist = items.map((item) => ({ ...item, thumbnail: null, duration: null }));
  selectedIndex = -1;
  currentSourceName = sourceName;
  renderPlaylist();
  updateSourceLabels();
  selectVideo(0);
  updateFullscreenNavigation();
  statusText.textContent = "";
  buildPlaylistPreviewData();
}

function setSingleFileMode(file) {
  const objectUrl = URL.createObjectURL(file);
  revokePlaylistObjectUrls(playlist);
  playlist = [];
  selectedIndex = -1;
  currentSourceName = "";
  previewGenerationId += 1;
  renderPlaylist();
  updateSourceLabels();
  clearStandaloneObjectUrl();
  standaloneObjectUrl = objectUrl;
  setVideoSource(objectUrl, file.name);
  ensureHoverPreviewVideo(objectUrl);
  applyBackdrop(null);
  updateTimelineProgress();
  updateFullscreenNavigation();
}

function goToAdjacentVideo(direction) {
  if (playlist.length <= 1 || selectedIndex < 0) {
    return;
  }

  const nextIndex = selectedIndex + direction;
  if (nextIndex < 0 || nextIndex >= playlist.length) {
    return;
  }

  selectVideo(nextIndex, { autoplay: !video.paused && Boolean(video.src) });
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

function updateTimelineProgress() {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    timelineProgress.style.width = "0%";
    timeModeButton.textContent = "00:00 / 00:00";
    return;
  }

  const ratio = clamp(video.currentTime / video.duration, 0, 1);
  timelineProgress.style.width = `${ratio * 100}%`;
  const watchedText = formatDuration(video.currentTime);
  const totalText = formatDuration(video.duration);
  const remaining = Math.max(0, video.duration - video.currentTime);
  const leftText = timeDisplayMode === "watched" ? watchedText : `-${formatDuration(remaining)}`;
  timeModeButton.textContent = `${leftText} / ${totalText}`;
}

function updateSpeedButton() {
  const displayRate = Number.isFinite(video.playbackRate) ? video.playbackRate : 1;
  speedButton.textContent = `${displayRate}x`;

  const options = [...document.querySelectorAll(".speed-option[data-speed]")];
  options.forEach((option) => {
    const speedValue = Number(option.dataset.speed);
    option.classList.toggle("selected", Math.abs(speedValue - displayRate) < 0.001);
  });
}

function updatePlayPauseIcon() {
  if (video.paused) {
    playPauseIcon.innerHTML = "<path d=\"M8 5v14l11-7z\" />";
    playPauseButton.setAttribute("aria-label", "Play video");
  } else {
    playPauseIcon.innerHTML = "<path d=\"M6 5h4v14H6zM14 5h4v14h-4z\" />";
    playPauseButton.setAttribute("aria-label", "Pause video");
  }
}

function hideSpeedUi() {
  speedPopover.hidden = true;
  speedMenu.hidden = false;
  customSpeedInputWrap.hidden = true;
  speedButton.setAttribute("aria-expanded", "false");
  scheduleControlsHide();
}

function updateFullscreenIcon() {
  const isFullscreen = Boolean(document.fullscreenElement);
  if (isFullscreen) {
    fullscreenIcon.innerHTML = "<path d=\"M9 3v6H3M15 3v6h6M21 15h-6v6M3 15h6v6\" />";
    fullscreenToggleButton.setAttribute("aria-label", "Minimize video");
    return;
  }

  fullscreenIcon.innerHTML = "<path d=\"M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6\" />";
  fullscreenToggleButton.setAttribute("aria-label", "Maximize video");
}

async function togglePictureInPicture() {
  if (!video?.src || !document.pictureInPictureEnabled) {
    return;
  }

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
      return;
    }

    await video.requestPictureInPicture();
  } catch {
    statusText.textContent = "Unable to enter Picture-in-Picture mode.";
  }
}

function togglePlayPause() {
  if (!video.src) {
    return;
  }

  showControls();

  if (video.paused) {
    video.play().catch(() => {
      statusText.textContent = "Unable to play video.";
    });
    return;
  }

  video.pause();
}

function applyPlaybackRate(speed) {
  const numeric = Number(speed);
  if (!Number.isFinite(numeric)) {
    return;
  }

  const next = clamp(numeric, 0.25, 4);
  video.playbackRate = Math.round(next * 100) / 100;
  updateSpeedButton();
}

function changePlaybackByStep(direction) {
  const next = clamp(video.playbackRate + (0.25 * direction), 0.25, 4);
  applyPlaybackRate(next);
  statusText.textContent = `Playback speed: ${video.playbackRate}x`;
  showControls();
}

function getTimelinePointerTime(event) {
  const rect = timeline.getBoundingClientRect();
  const pointerX = clamp(event.clientX - rect.left, 0, rect.width);
  const ratio = rect.width > 0 ? pointerX / rect.width : 0;
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  return {
    pointerX,
    ratio,
    time: duration * ratio
  };
}

function setTimelinePreviewImageAt(time) {
  const selected = playlist[selectedIndex] || null;

  if (selected?.thumbnail && !timelinePreviewImage.src) {
    timelinePreviewImage.src = selected.thumbnail;
  }

  const now = performance.now();
  if (now - lastHoverCaptureTime < 130) {
    return;
  }
  lastHoverCaptureTime = now;

  const sourceVideo = hoverPreviewVideo;
  if (!sourceVideo) {
    return;
  }

  const doSeek = () => {
    const requestId = ++hoverPreviewRequestId;

    const onSeeked = () => {
      if (requestId !== hoverPreviewRequestId) {
        return;
      }

      const image = capturePreviewImage(
        sourceVideo,
        TIMELINE_PREVIEW_CAPTURE_WIDTH,
        TIMELINE_PREVIEW_CAPTURE_HEIGHT
      );
      if (image) {
        timelinePreviewImage.src = image;
      }
    };

    sourceVideo.addEventListener("seeked", onSeeked, { once: true });
    try {
      sourceVideo.currentTime = time;
    } catch {
      // Ignore seek errors for formats that restrict random access.
    }
  };

  if (sourceVideo.readyState < 1) {
    sourceVideo.addEventListener("loadedmetadata", doSeek, { once: true });
    return;
  }

  doSeek();
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {
      statusText.textContent = "Unable to exit fullscreen.";
    });
    return;
  }

  playerShell.requestFullscreen().catch(() => {
    statusText.textContent = "Unable to enter fullscreen.";
  });
}

function toggleSidebar() {
  if (!playlistSidebar) {
    return;
  }

  const nextCollapsed = !playlistSidebar.classList.contains("collapsed");
  playlistSidebar.classList.toggle("collapsed", nextCollapsed);
  sidebarToggleButton?.setAttribute("aria-expanded", String(!nextCollapsed));

  if (nextCollapsed) {
    // Save current width before collapsing, clear inline style so collapsed overrides work
    playlistSidebar.dataset.widthBeforeCollapse = playlistSidebar.style.width || "";
    playlistSidebar.style.width = "";
  } else {
    // Restore user-dragged width if any
    const saved = playlistSidebar.dataset.widthBeforeCollapse;
    if (saved) {
      playlistSidebar.style.width = saved;
    }
  }

  if (sidebarToggleButton) {
    sidebarToggleButton.innerHTML = `<span aria-hidden="true">${nextCollapsed ? "&#10095;" : "&#10094;"}</span>`;
  }
}

function openInfoDialog() {
  showControls();

  const selected = playlist[selectedIndex] || null;
  const knownDurations = getKnownDurations();
  const folderTotal = knownDurations.length > 0
    ? formatDuration(knownDurations.reduce((sum, duration) => sum + duration, 0))
    : "Unknown";

  const lines = [
    `File: ${selected?.fileName ?? "Single selected file"}`,
    `Current duration: ${formatDuration(video.duration)}`,
    `Resolution: ${video.videoWidth > 0 ? `${video.videoWidth} x ${video.videoHeight}` : "Unknown"}`,
    `Source: ${currentSourceName || "Manual selection"}`,
    `Videos loaded: ${playlist.length || 1}`,
    `Folder total duration: ${playlist.length > 1 ? folderTotal : "Not applicable"}`
  ];

  const text = lines.join("\n");

  if (infoDialog && typeof infoDialog.showModal === "function") {
    infoContent.textContent = text;
    if (!infoDialog.open) {
      infoDialog.showModal();
    }
    return;
  }

  window.alert(text);
}

viewListButton.addEventListener("click", () => {
  playlistView = "list";
  renderPlaylist();
});

viewGridButton.addEventListener("click", () => {
  playlistView = "grid";
  renderPlaylist();
});

infoButton.addEventListener("click", () => {
  openInfoDialog();
});

timeModeButton.addEventListener("click", () => {
  timeDisplayMode = timeDisplayMode === "watched" ? "remaining" : "watched";
  updateTimelineProgress();
});

speedButton.addEventListener("click", () => {
  const isOpen = !speedPopover.hidden;
  speedPopover.hidden = isOpen;
  speedMenu.hidden = false;
  customSpeedInputWrap.hidden = true;
  speedButton.setAttribute("aria-expanded", String(!isOpen));
  showControls();
});

controlsLockButton?.addEventListener("click", () => {
  controlsLocked = !controlsLocked;
  updateControlsLockButton();
  showControls();
});

speedMenu.addEventListener("click", (event) => {
  const button = event.target.closest(".speed-option[data-speed]");
  if (!button) {
    return;
  }

  const speedValue = Number(button.dataset.speed);
  if (Number.isFinite(speedValue)) {
    applyPlaybackRate(speedValue);
    statusText.textContent = `Playback speed: ${video.playbackRate}x`;
    hideSpeedUi();
  }
});

customSpeedButton.addEventListener("click", () => {
  speedMenu.hidden = true;
  customSpeedInputWrap.hidden = false;
  customSpeedInput.value = String(video.playbackRate);
  customSpeedInput.focus();
  showControls();
});

applyCustomSpeedButton.addEventListener("click", () => {
  const customValue = Number(customSpeedInput.value);
  if (!Number.isFinite(customValue)) {
    return;
  }

  applyPlaybackRate(customValue);
  statusText.textContent = `Playback speed: ${video.playbackRate}x`;
  hideSpeedUi();
});

playPauseButton.addEventListener("click", (event) => {
  event.stopPropagation();
  togglePlayPause();
});

fullscreenToggleButton.addEventListener("click", () => {
  toggleFullscreen();
});

prevVideoButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  goToAdjacentVideo(-1);
  showControls();
});

nextVideoButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  goToAdjacentVideo(1);
  showControls();
});

pipButton?.addEventListener("click", () => {
  togglePictureInPicture();
  showControls();
});

video.addEventListener("click", () => {
  togglePlayPause();
});

overlayControls.addEventListener("click", (event) => {
  event.stopPropagation();
});

videoStage?.addEventListener("mousemove", () => {
  showControls();
});

videoStage?.addEventListener("mousemove", (event) => {
  const rect = videoStage.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;
  const offsetY = event.clientY - rect.top;
  const navBandHeight = Math.min(400, rect.height);
  const bandTop = (rect.height - navBandHeight) / 2;
  const isInVerticalBand = offsetY >= bandTop && offsetY <= bandTop + navBandHeight;
  const isFullscreenPlaylist = document.fullscreenElement === playerShell && playlist.length > 1;
  const showPrev = isFullscreenPlaylist && isInVerticalBand && offsetX >= 0 && offsetX <= 100;
  const showNext = isFullscreenPlaylist && isInVerticalBand && offsetX >= rect.width - 100 && offsetX <= rect.width;

  videoStage.classList.toggle("fullscreen-nav-prev-visible", showPrev);
  videoStage.classList.toggle("fullscreen-nav-next-visible", showNext);
});

videoStage?.addEventListener("mouseleave", () => {
  videoStage.classList.remove("fullscreen-nav-prev-visible");
  videoStage.classList.remove("fullscreen-nav-next-visible");
  if (!controlsLocked && speedPopover.hidden) {
    setControlsVisible(false);
    clearControlsHideTimer();
  }
});

videoStage?.addEventListener("focusin", () => {
  showControls();
});

document.addEventListener("click", (event) => {
  if (!speedPopover.hidden && !event.target.closest(".speed-wrap")) {
    hideSpeedUi();
  }
});

sidebarToggleButton?.addEventListener("click", () => {
  toggleSidebar();
});

timeline.addEventListener("mousemove", (event) => {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }

  showControls();
  const { pointerX, time } = getTimelinePointerTime(event);
  timelinePreview.classList.add("expanded");
  timelinePreview.hidden = false;
  timelinePreview.style.left = `${pointerX}px`;
  timelinePreviewTime.textContent = formatDuration(time);
  setTimelinePreviewImageAt(time);
});

timeline.addEventListener("mouseleave", () => {
  timelinePreview.classList.remove("expanded");
  timelinePreview.hidden = true;
});

timeline.addEventListener("click", (event) => {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return;
  }

  showControls();
  const { time } = getTimelinePointerTime(event);
  video.currentTime = time;
  updateTimelineProgress();
});

video.addEventListener("timeupdate", () => {
  updateTimelineProgress();
  updatePlayPauseIcon();
});

video.addEventListener("durationchange", () => {
  updateTimelineProgress();
});

video.addEventListener("loadedmetadata", () => {
  updateTimelineProgress();
  updatePlayPauseIcon();
  updateSpeedButton();

  if (selectedIndex >= 0 && playlist[selectedIndex]) {
    playlist[selectedIndex].duration = video.duration;
    updatePlaylistCard(selectedIndex);
    updateSourceLabels();
  }
});

video.addEventListener("ratechange", () => {
  updateSpeedButton();
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

  setPlaylist([result], "");
});

openFolderButton.addEventListener("click", async () => {
  if (!window.electronAPI?.openVideoFolderDialog) {
    statusText.textContent = "Native folder picker is only available in desktop app mode.";
    return;
  }

  const result = await window.electronAPI.openVideoFolderDialog();
  const items = result?.items ?? [];

  if (items.length === 0) {
    statusText.textContent = "No videos found in that folder.";
    return;
  }

  setPlaylist(items, result?.sourceName ?? "");
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

  const result = await window.electronAPI.resolveDroppedPaths(droppedPaths);
  setPlaylist(result?.items ?? [], result?.sourceName ?? "");
});

window.addEventListener("keydown", (event) => {
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
    showControls();

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
    showControls();
    video.currentTime = Math.max(0, video.currentTime - 10);
    statusText.textContent = `Seeked to ${formatDuration(video.currentTime)}`;
    return;
  }

  if (event.code === "ArrowRight") {
    event.preventDefault();
    showControls();
    const duration = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime + 10;
    video.currentTime = Math.min(duration, video.currentTime + 10);
    statusText.textContent = `Seeked to ${formatDuration(video.currentTime)}`;
    return;
  }

  if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    showControls();
    toggleFullscreen();
    return;
  }

  if (event.shiftKey && event.key === ">") {
    event.preventDefault();
    changePlaybackByStep(1);
    return;
  }

  if (event.shiftKey && event.key === "<") {
    event.preventDefault();
    changePlaybackByStep(-1);
    return;
  }

  if (event.key.toLowerCase() === "i") {
    event.preventDefault();
    openInfoDialog();
  }
}, true);

window.addEventListener("beforeunload", () => {
  clearStandaloneObjectUrl();
  revokePlaylistObjectUrls(playlist);
});

video.addEventListener("ended", () => {
  statusText.textContent = "Playback ended.";
  updatePlayPauseIcon();
  showControls();
});

video.addEventListener("play", () => {
  updatePlayPauseIcon();
  scheduleControlsHide();
});

video.addEventListener("pause", () => {
  updatePlayPauseIcon();
  showControls();
});

document.addEventListener("fullscreenchange", () => {
  updateFullscreenIcon();
  updateFullscreenNavigation();
  showControls();
});

updateTimelineProgress();
updateSpeedButton();
updateSidebarVisibility();
updatePlayPauseIcon();
updateFullscreenIcon();
updateControlsLockButton();
updateFullscreenNavigation();
showControls();

// Sidebar drag-resize
(function initSidebarResize() {
  if (!sidebarResizer || !playlistSidebar || !layoutShell) {
    return;
  }

  let isDragging = false;
  let startX = 0;
  let startWidth = 0;
  const MIN_WIDTH = 180;
  const MAX_WIDTH = 520;

  sidebarResizer.addEventListener("mousedown", (event) => {
    if (playlistSidebar.classList.contains("collapsed")) {
      return;
    }

    isDragging = true;
    startX = event.clientX;
    startWidth = playlistSidebar.getBoundingClientRect().width;
    layoutShell.classList.add("resizing");
    sidebarResizer.classList.add("dragging");
    event.preventDefault();
  });

  window.addEventListener("mousemove", (event) => {
    if (!isDragging) {
      return;
    }

    const delta = event.clientX - startX;
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
    playlistSidebar.style.width = `${next}px`;
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    layoutShell.classList.remove("resizing");
    sidebarResizer.classList.remove("dragging");
  });
}());
