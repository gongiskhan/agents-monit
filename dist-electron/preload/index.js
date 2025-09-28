"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, ...args) => {
        const validChannels = [
            'get-sessions',
            'get-active-sessions',
            'refresh-sessions',
            'focus-window',
            'get-session-details',
        ];
        if (validChannels.includes(channel)) {
            return electron_1.ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid channel: ${channel}`);
    },
    on: (channel, callback) => {
        const validChannels = ['sessions-updated'];
        if (validChannels.includes(channel)) {
            const subscription = (event, ...args) => callback(event, ...args);
            electron_1.ipcRenderer.on(channel, subscription);
            // Return a function to remove the listener
            return () => {
                electron_1.ipcRenderer.removeListener(channel, subscription);
            };
        }
        throw new Error(`Invalid channel: ${channel}`);
    },
});
//# sourceMappingURL=index.js.map