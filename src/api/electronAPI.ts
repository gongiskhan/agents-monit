// Electron API wrapper to replace Tauri's invoke
// This provides a consistent API interface for the React components

export const invoke = async <T = any>(command: string, args?: any): Promise<T> => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  switch (command) {
    case 'get_sessions':
      return window.electronAPI.invoke('get-sessions') as Promise<T>;

    case 'get_active_sessions':
      return window.electronAPI.invoke('get-active-sessions') as Promise<T>;

    case 'refresh_sessions':
      return window.electronAPI.invoke('refresh-sessions') as Promise<T>;

    case 'focus_window':
      return window.electronAPI.invoke('focus-window', args?.sessionId) as Promise<T>;

    case 'get_session_details':
      return window.electronAPI.invoke('get-session-details', args?.sessionId) as Promise<T>;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

export const listen = <T = any>(
  event: string,
  callback: (payload: { payload: T }) => void
): Promise<() => void> => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  if (event === 'sessions_updated') {
    const unsubscribe = window.electronAPI.on('sessions-updated', (_, data) => {
      callback({ payload: data });
    });

    return Promise.resolve(unsubscribe);
  }

  throw new Error(`Unknown event: ${event}`);
};

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
    };
  }
}