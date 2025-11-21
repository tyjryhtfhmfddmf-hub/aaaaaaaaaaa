export interface IElectronAPI {
  // FIX: Use Uint8Array instead of Buffer, as Buffers are received as Uint8Arrays in the renderer.
  openFolderDialog: () => Promise<{ name: string; type: string; buffer: Uint8Array; size: number }[] | undefined>;
  checkForUpdates: () => void;
  onUpdateStatus: (callback: (status: string) => void) => void;
}

interface FastAverageColorResult {
    rgba: string;
    isDark: boolean;
    hex: string;
    value: number[];
}

interface IFastAverageColor {
    getColorAsync(resource: string | HTMLImageElement): Promise<FastAverageColorResult>;
}


declare global {
  interface Window {
    electronAPI: IElectronAPI;
    FastAverageColor: { new(): IFastAverageColor };
  }
}
