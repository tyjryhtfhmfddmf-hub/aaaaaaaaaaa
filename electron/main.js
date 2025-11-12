const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ipcMain.handle('open-folder-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (canceled || filePaths.length === 0) {
      return;
    }
    const folderPath = filePaths[0];
    const filesInDir = fs.readdirSync(folderPath);
    const audioFiles = [];
    const supportedExtensions = ['.mp3', '.m4a', '.wav', '.flac', '.ogg'];
    const mimeTypes = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.flac': 'audio/flac', '.ogg': 'audio/ogg' };

    for (const file of filesInDir) {
        const filePath = path.join(folderPath, file);
        const fileExt = path.extname(file).toLowerCase();
        if (supportedExtensions.includes(fileExt)) {
            try {
                const buffer = fs.readFileSync(filePath);
                const stats = fs.statSync(filePath);
                audioFiles.push({
                    name: file,
                    type: mimeTypes[fileExt] || 'application/octet-stream',
                    buffer: buffer,
                    size: stats.size,
                });
            } catch (err) {
                console.error(`Error reading file ${filePath}:`, err);
            }
        }
    }
    return audioFiles;
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
