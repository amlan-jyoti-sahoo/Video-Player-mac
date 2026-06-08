const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const isMac = process.platform === "darwin";
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);
const APP_METADATA_DIRNAME = ".our";
const APP_METADATA_FILE = "video-player-state.json";
const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

function isHiddenPathName(name) {
  return typeof name === "string" && name.startsWith(".");
}

function compareVideoPaths(a, b) {
  const nameCompare = NATURAL_COLLATOR.compare(path.basename(a), path.basename(b));
  if (nameCompare !== 0) {
    return nameCompare;
  }

  return NATURAL_COLLATOR.compare(a, b);
}

function isVideoFile(filePath) {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function toVideoItem(filePath) {
  return {
    filePath,
    fileName: path.basename(filePath),
    videoUrl: pathToFileURL(filePath).href
  };
}

async function collectVideoFilesFromDirectory(dirPath) {
  const discovered = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  entries.sort((a, b) => NATURAL_COLLATOR.compare(a.name, b.name));

  for (const entry of entries) {
    if (isHiddenPathName(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectVideoFilesFromDirectory(fullPath);
      discovered.push(...nested);
      continue;
    }

    if (entry.isFile() && isVideoFile(fullPath)) {
      discovered.push(fullPath);
    }
  }

  return discovered;
}

function getFolderStatePaths(folderPath) {
  const metadataDir = path.join(folderPath, APP_METADATA_DIRNAME);
  const stateFile = path.join(metadataDir, APP_METADATA_FILE);
  return { metadataDir, stateFile };
}

async function ensureFolderStateDir(folderPath) {
  const { metadataDir } = getFolderStatePaths(folderPath);
  await fs.mkdir(metadataDir, { recursive: true });
  return metadataDir;
}

function sanitizeFolderState(rawState) {
  if (!rawState || typeof rawState !== "object") {
    return {
      version: 1,
      lastPlayedRelativePath: "",
      videos: {}
    };
  }

  const sanitizedVideos = {};
  const inputVideos = rawState.videos && typeof rawState.videos === "object"
    ? rawState.videos
    : {};

  for (const [relativePath, value] of Object.entries(inputVideos)) {
    if (typeof relativePath !== "string" || !relativePath) {
      continue;
    }

    const entry = value && typeof value === "object" ? value : {};
    const position = Number(entry.position);
    const duration = Number(entry.duration);

    sanitizedVideos[relativePath] = {
      position: Number.isFinite(position) && position >= 0 ? position : 0,
      duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
      seen: Boolean(entry.seen)
    };
  }

  return {
    version: 1,
    lastPlayedRelativePath:
      typeof rawState.lastPlayedRelativePath === "string" ? rawState.lastPlayedRelativePath : "",
    videos: sanitizedVideos
  };
}

async function normalizePathsToVideoItems(paths) {
  const foundPaths = [];

  for (const inputPath of paths) {
    try {
      const stats = await fs.stat(inputPath);

      if (stats.isDirectory()) {
        const folderVideos = await collectVideoFilesFromDirectory(inputPath);
        foundPaths.push(...folderVideos);
        continue;
      }

      if (stats.isFile() && isVideoFile(inputPath)) {
        foundPaths.push(inputPath);
      }
    } catch {
      // Ignore inaccessible or removed paths.
    }
  }

  const deduped = [...new Set(foundPaths)].sort(compareVideoPaths);
  return deduped.map(toVideoItem);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 360,
    minHeight: 360,
    title: "Local Video Player",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile("index.html");
}

const menuTemplate = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" }
          ]
        }
      ]
    : []),
  {
    label: "File",
    submenu: [{ role: isMac ? "close" : "quit" }]
  },
  {
    label: "View",
    submenu: [{ role: "reload" }, { role: "togglefullscreen" }]
  }
];

ipcMain.handle("pick-video-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose a video",
    properties: ["openFile"],
    filters: [
      {
        name: "Videos",
        extensions: ["mp4", "mov", "m4v", "mkv", "webm", "avi"]
      }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return toVideoItem(result.filePaths[0]);
});

ipcMain.handle("pick-video-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Choose a folder with videos",
    properties: ["openDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { items: [], sourceName: "" };
  }

  const folderPath = result.filePaths[0];
  const items = await normalizePathsToVideoItems([folderPath]);
  return { items, sourceName: path.basename(folderPath), sourceRootPath: folderPath };
});

ipcMain.handle("resolve-video-paths", async (_event, paths = []) => {
  if (!Array.isArray(paths) || paths.length === 0) {
    return { items: [], sourceName: "" };
  }

  const folderNames = [];
  const folderPaths = [];

  for (const inputPath of paths) {
    try {
      const stats = await fs.stat(inputPath);
      if (stats.isDirectory()) {
        folderNames.push(path.basename(inputPath));
        folderPaths.push(inputPath);
      }
    } catch {
      // Ignore inaccessible or removed paths.
    }
  }

  const sourceName = folderNames.length === 1
    ? folderNames[0]
    : folderNames.length > 1
      ? "Multiple folders"
      : "";
  const sourceRootPath = folderPaths.length === 1 ? folderPaths[0] : "";

  const items = await normalizePathsToVideoItems(paths);
  return { items, sourceName, sourceRootPath };
});

ipcMain.handle("load-folder-state", async (_event, folderPath = "") => {
  if (typeof folderPath !== "string" || !folderPath) {
    return {
      version: 1,
      lastPlayedRelativePath: "",
      videos: {}
    };
  }

  try {
    await ensureFolderStateDir(folderPath);
    const { stateFile } = getFolderStatePaths(folderPath);
    const rawText = await fs.readFile(stateFile, "utf8");
    return sanitizeFolderState(JSON.parse(rawText));
  } catch {
    return {
      version: 1,
      lastPlayedRelativePath: "",
      videos: {}
    };
  }
});

ipcMain.handle("save-folder-state", async (_event, folderPath = "", state = {}) => {
  if (typeof folderPath !== "string" || !folderPath) {
    return { ok: false };
  }

  try {
    await ensureFolderStateDir(folderPath);
    const sanitized = sanitizeFolderState(state);
    const { stateFile } = getFolderStatePaths(folderPath);
    await fs.writeFile(stateFile, `${JSON.stringify(sanitized, null, 2)}\n`, "utf8");
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (!isMac) {
    app.quit();
  }
});
