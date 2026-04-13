const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const isMac = process.platform === "darwin";
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi"]);

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

  for (const entry of entries) {
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

  const deduped = [...new Set(foundPaths)].sort((a, b) => a.localeCompare(b));
  return deduped.map(toVideoItem);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 760,
    minHeight: 520,
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
    return [];
  }

  return normalizePathsToVideoItems([result.filePaths[0]]);
});

ipcMain.handle("resolve-video-paths", async (_event, paths = []) => {
  if (!Array.isArray(paths) || paths.length === 0) {
    return [];
  }

  return normalizePathsToVideoItems(paths);
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
