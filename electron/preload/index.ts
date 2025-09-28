import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: (channel: string, ...args: any[]) => {
    const validChannels = [
      'get-sessions',
      'get-active-sessions',
      'refresh-sessions',
      'focus-window',
      'get-session-details',
    ];

    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error(`Invalid channel: ${channel}`);
  },

  on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
    const validChannels = ['sessions-updated'];

    if (validChannels.includes(channel)) {
      const subscription = (event: any, ...args: any[]) => callback(event, ...args);
      ipcRenderer.on(channel, subscription);

      // Return a function to remove the listener
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    throw new Error(`Invalid channel: ${channel}`);
  },
});

// Add TypeScript types for the window object
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
    };
  }
}