const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  openVideoDialog: async () => {
    const videoItem = await ipcRenderer.invoke("pick-video-file");

    if (!videoItem) {
      return null;
    }

    return videoItem;
  },
  openVideoFolderDialog: async () => {
    return ipcRenderer.invoke("pick-video-folder");
  },
  resolveDroppedPaths: async (paths) => {
    return ipcRenderer.invoke("resolve-video-paths", paths);
  },
  loadFolderState: async (folderPath) => {
    return ipcRenderer.invoke("load-folder-state", folderPath);
  },
  saveFolderState: async (folderPath, state) => {
    return ipcRenderer.invoke("save-folder-state", folderPath, state);
  }
});
